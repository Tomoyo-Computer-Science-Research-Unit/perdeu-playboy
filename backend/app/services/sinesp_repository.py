"""Sinesp VDE (Ministerio da Justica e Seguranca Publica): fonte nacional, por UF, municipio e mes.

O MJSP publica um arquivo por ano (``bancovde-AAAA.xlsx``, desde 2015, ~25 MB cada) com eventos de
todas as UFs, enviados pelas secretarias estaduais. Este modulo e a fonte generica para qualquer UF sem
fonte estadual propria, e o complemento de SP (morte por intervencao de agente do Estado).

* Os ``.xlsx`` ficam em ``data/raw/sinesp/`` (ignorados pelo git).
* :func:`extract_uf` grava ``data/raw/sinesp/<uf>_vde.csv.gz`` (versionado para as UFs publicadas):
  so a UF pedida, so os eventos usados, abrangencia estadual, uma linha por municipio, evento e mes.
* :func:`rows`, :func:`territories` e :func:`latest_period` tem a mesma interface do ``isp_repository``.

Municipios vem em maiusculas ("BELO HORIZONTE"); o nome publicado e o do IBGE (localidades), casado sem
acento. Linhas com municipio "NAO INFORMADO" entram so no total estadual.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import time
import unicodedata
from calendar import monthrange
from datetime import date
from functools import lru_cache
from pathlib import Path

import httpx
import pandas as pd

from app.config import settings
from app.etl import ibge_http
from app.uf import current

logger = logging.getLogger(__name__)

OFFICIAL_SOURCE_NAME = "Sinesp VDE/MJSP"
FIRST_YEAR = 2015
VDE_URL = (
    "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/download/"
    "dnsp-base-de-dados/bancovde-{year}.xlsx/@@download/file"
)
VDE_PAGE_URL = (
    "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1/"
    "base-de-dados-e-notas-metodologicas-dos-gestores-estaduais-sinesp-vde-2022-e-2023"
)

# Evento do VDE (rotulo normalizado) -> indicador do site. Estupro soma estupro e estupro de vulneravel,
# como o "total de estupro" da SSP-SP.
EVENT_TO_INDICATOR = {
    "HOMICIDIO DOLOSO": "homicidio_doloso",
    "LESAO CORPORAL SEGUIDA DE MORTE": "lesao_corp_morte",
    "ROUBO SEGUIDO DE MORTE": "latrocinio",
    "FEMINICIDIO": "feminicidio",
    "MORTE POR INTERVENCAO DE AGENTE DO ESTADO": "morte_interv_policial",
    "ESTUPRO": "estupro",
    "ESTUPRO DE VULNERAVEL": "estupro",
    "ROUBO DE VEICULO": "roubo_veiculo",
    "ROUBO DE CARGA": "roubo_carga",
    "ARMA DE FOGO APREENDIDA": "apreensao_armas",
}
LETHALITY_COMPONENTS = ("homicidio_doloso", "latrocinio", "lesao_corp_morte", "morte_interv_policial")
UNKNOWN_MUNICIPALITY = "NAO INFORMADO"
# Grafias do VDE que diferem do IBGE (chave sem acento -> chave do IBGE), por UF.
MUNICIPALITY_ALIASES: dict[str, dict[str, str]] = {
    "MG": {"barao de monte alto": "barao do monte alto"},
}
COLUMNS = ["municipio", "indicator", "year", "month", "value"]
STATS_COLUMNS = [
    "source_name", "territory_type", "territory_name", "police_area_name", "ibge_code",
    "year", "month", "period_date", "indicator", "value",
]
REFRESH_HOURS = 20


def raw_dir() -> Path:
    return (settings.data_dir / "raw" / "sinesp").resolve()


def xlsx_path(year: int) -> Path:
    return raw_dir() / f"bancovde-{year}.xlsx"


def extract_path(uf: str) -> Path:
    return raw_dir() / f"{uf.lower()}_vde.csv.gz"


# --- Download --------------------------------------------------------------------------------


def download(end_year: int | None = None, refresh_current: bool = True) -> list[int]:
    """Baixa os arquivos anuais que faltam (e o do ano corrente, se tiver mais de 20 h). Devolve os anos baixados."""

    end_year = end_year or date.today().year
    fetched: list[int] = []
    raw_dir().mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": "perdeu-playboy/1.0 (+https://g0v.tomoyo.systems/perdeu-playboy/)"}
    with httpx.Client(follow_redirects=True, headers=headers) as client:
        for year in range(FIRST_YEAR, end_year + 1):
            path = xlsx_path(year)
            fresh = path.exists() and path.stat().st_size > 0
            if fresh and not (refresh_current and year == end_year and _older_than_hours(path, REFRESH_HOURS)):
                continue
            if _download_file(client, VDE_URL.format(year=year), path):
                fetched.append(year)
            time.sleep(1)
    return fetched


def _download_file(client: httpx.Client, url: str, path: Path, attempts: int = 5) -> bool:
    """Baixa em partes; o gov.br corta conexoes longas com frequencia, entao ha novas tentativas."""

    tmp = path.with_suffix(".part")
    for attempt in range(1, attempts + 1):
        try:
            with client.stream("GET", url, timeout=httpx.Timeout(600, connect=30)) as response:
                response.raise_for_status()
                expected = int(response.headers.get("content-length") or 0)
                with tmp.open("wb") as file:
                    for chunk in response.iter_bytes():
                        file.write(chunk)
            if expected and tmp.stat().st_size != expected:
                raise httpx.ReadError(f"{tmp.stat().st_size} de {expected} bytes")
            tmp.replace(path)
            return True
        except httpx.HTTPError as exc:
            logger.warning("Sinesp VDE %s tentativa %s/%s: %s", url, attempt, attempts, exc)
            tmp.unlink(missing_ok=True)
            time.sleep(10 * attempt)
    return False


def _older_than_hours(path: Path, hours: float) -> bool:
    return not path.exists() or (time.time() - path.stat().st_mtime) > hours * 3600


# --- Extracao por UF -------------------------------------------------------------------------


def extract_uf(uf: str) -> Path:
    """Gera o CSV compacto de uma UF a partir dos ``.xlsx`` presentes; anos sem arquivo ficam como estavam."""

    frames: list[pd.DataFrame] = []
    years_read: set[int] = set()
    for path in sorted(raw_dir().glob("bancovde-*.xlsx")):
        year = int(re.findall(r"\d{4}", path.name)[0])
        frames.append(_extract_year(path, uf))
        years_read.add(year)
    target = extract_path(uf)
    if target.exists():
        previous = pd.read_csv(target)
        frames.append(previous[~previous["year"].isin(years_read)])
    frame = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=COLUMNS)
    frame = frame.groupby(["municipio", "indicator", "year", "month"], as_index=False)["value"].sum()
    # Meses depois do ultimo publicado vem zerados no VDE: o corte e o ultimo mes com homicidio no estado.
    homicides = frame[frame["indicator"] == "homicidio_doloso"].groupby(["year", "month"])["value"].sum()
    homicides = homicides[homicides > 0]
    if not homicides.empty:
        last_year, last_month = homicides.index.max()
        frame = frame[(frame["year"] < last_year) | ((frame["year"] == last_year) & (frame["month"] <= last_month))]
    frame = frame.sort_values(["municipio", "indicator", "year", "month"])
    target.parent.mkdir(parents=True, exist_ok=True)
    frame[COLUMNS].to_csv(target, index=False, compression={"method": "gzip", "mtime": 0})
    _stats_frame_for.cache_clear()
    return target


def _year_cache(path: Path) -> pd.DataFrame:
    """Eventos usados de todas as UFs num ano, em CSV (ler o .xlsx leva um minuto; o CSV, um segundo).

    O cache ``vde-AAAA.csv.gz`` (ignorado pelo git) e refeito quando o .xlsx e mais novo.
    """

    cache = path.with_name(path.name.replace("bancovde-", "vde-").replace(".xlsx", ".csv.gz"))
    if cache.exists() and cache.stat().st_mtime >= path.stat().st_mtime:
        return pd.read_csv(cache, dtype={"uf": str, "municipio": str})
    logger.info("lendo %s", path.name)
    frame = pd.read_excel(path, dtype={"uf": str, "municipio": str, "evento": str, "abrangencia": str})
    frame["label"] = frame["evento"].map(_normalize_label)
    frame = frame[frame["label"].isin(EVENT_TO_INDICATOR)]
    # Policia Federal e Rodoviaria Federal aparecem como abrangencias proprias; o site usa a estadual.
    frame = frame[frame["abrangencia"].astype(str).map(_normalize_label) == "ESTADUAL"].copy()
    frame["date"] = pd.to_datetime(frame["data_referencia"], errors="coerce")
    frame = frame.dropna(subset=["date"])
    victims = pd.to_numeric(frame["total_vitima"], errors="coerce")
    occurrences = pd.to_numeric(frame["total"], errors="coerce")
    frame["value"] = victims.where(victims.notna(), occurrences)
    frame = frame.dropna(subset=["value"])
    frame["indicator"] = frame["label"].map(EVENT_TO_INDICATOR)
    frame["year"] = frame["date"].dt.year
    frame["month"] = frame["date"].dt.month
    frame["uf"] = frame["uf"].astype(str).str.upper().str.strip()
    frame["municipio"] = frame["municipio"].astype(str).str.strip()
    frame = frame.groupby(["uf", "municipio", "indicator", "year", "month"], as_index=False)["value"].sum()
    frame.to_csv(cache, index=False, compression={"method": "gzip", "mtime": 0})
    return frame


def _extract_year(path: Path, uf: str) -> pd.DataFrame:
    frame = _year_cache(path)
    return frame.loc[frame["uf"] == uf.upper(), COLUMNS]


# --- Leitura (mesma interface do isp_repository) --------------------------------------------


@lru_cache(maxsize=8)
def _stats_frame_for(uf: str, territory_type: str) -> pd.DataFrame:
    path = extract_path(uf)
    if not path.exists():
        raise FileNotFoundError(f"{path} ausente; rode python -m app.services.sinesp_repository --uf {uf}")
    raw = pd.read_csv(path)
    names = municipality_official_names(uf)
    aliases = MUNICIPALITY_ALIASES.get(uf.upper(), {})
    raw["key"] = raw["municipio"].map(lambda value: aliases.get(_name_key(value), _name_key(value)))
    # Meses depois do ultimo publicado vem zerados no VDE: o corte e o ultimo mes com homicidio no estado.
    homicides = raw[raw["indicator"] == "homicidio_doloso"].groupby(["year", "month"])["value"].sum()
    homicides = homicides[homicides > 0]
    if not homicides.empty:
        last_year, last_month = homicides.index.max()
        raw = raw[(raw["year"] < last_year) | ((raw["year"] == last_year) & (raw["month"] <= last_month))]
    if territory_type == "state":
        frame = raw.groupby(["indicator", "year", "month"], as_index=False)["value"].sum()
        frame["territory_name"] = current().state_name
        frame["ibge_code"] = None
    elif territory_type == "municipality":
        raw = raw[raw["key"] != _name_key(UNKNOWN_MUNICIPALITY)].copy()
        raw["territory_name"] = raw["key"].map(lambda key: names.get(key, (None, None))[1])
        raw["ibge_code"] = raw["key"].map(lambda key: names.get(key, (None, None))[0])
        unmatched = sorted(raw.loc[raw["territory_name"].isna(), "municipio"].unique())
        if unmatched:
            logger.warning("Sinesp %s: municipios sem par no IBGE: %s", uf, unmatched[:20])
        raw = raw.dropna(subset=["territory_name"])
        frame = raw.groupby(["territory_name", "ibge_code", "indicator", "year", "month"], as_index=False)["value"].sum()
    else:
        return pd.DataFrame(columns=STATS_COLUMNS)
    frame = pd.concat([frame, _lethality(frame)], ignore_index=True)
    frame["source_name"] = OFFICIAL_SOURCE_NAME
    frame["territory_type"] = territory_type
    frame["police_area_name"] = None
    frame["year"] = frame["year"].astype(int)
    frame["month"] = frame["month"].astype(int)
    frame["period_date"] = [date(y, m, monthrange(y, m)[1]) for y, m in zip(frame["year"], frame["month"])]
    return frame.loc[:, STATS_COLUMNS].reset_index(drop=True)


def _stats_frame(territory_type: str) -> pd.DataFrame:
    return _stats_frame_for(current().code, territory_type)


def _lethality(frame: pd.DataFrame) -> pd.DataFrame:
    """Letalidade violenta: soma dos quatro componentes, so nos meses em que todos tem linha."""

    parts = frame[frame["indicator"].isin(LETHALITY_COMPONENTS)]
    if parts.empty:
        return frame.iloc[0:0]
    keys = [column for column in ("territory_name", "ibge_code") if column in parts.columns] + ["year", "month"]
    grouped = parts.groupby(keys, dropna=False).agg(value=("value", "sum"), components=("indicator", "nunique")).reset_index()
    grouped = grouped[grouped["components"] == len(LETHALITY_COMPONENTS)].drop(columns="components")
    grouped["indicator"] = "letalidade_violenta"
    return grouped


def latest_period() -> tuple[int, int]:
    frame = _stats_frame("state")
    frame = frame[frame["indicator"] == "homicidio_doloso"]
    latest = frame.sort_values(["year", "month"]).iloc[-1]
    return int(latest["year"]), int(latest["month"])


def territories(territory_type: str) -> list[str]:
    frame = _stats_frame(territory_type)
    return sorted(str(name) for name in frame["territory_name"].dropna().unique())


def rows(
    indicator: str,
    territory_type: str,
    territory_name: str | None = None,
    start_year: int | None = None,
    end_year: int | None = None,
) -> pd.DataFrame:
    frame = _stats_frame(territory_type)
    filtered = frame[frame["indicator"] == indicator]
    if territory_name:
        filtered = filtered[filtered["territory_name"].str.casefold() == territory_name.casefold()]
    if start_year is not None:
        filtered = filtered[filtered["year"] >= start_year]
    if end_year is not None:
        filtered = filtered[filtered["year"] <= end_year]
    return filtered.sort_values(["territory_name", "year", "month"]).copy()


@lru_cache(maxsize=32)
def municipality_official_names(uf: str) -> dict[str, tuple[str, str]]:
    """Chave sem acento -> (codigo IBGE, nome IBGE) dos municipios da UF."""

    path = settings.data_dir / "raw" / "ibge" / f"localidades_{uf.lower()}_municipios.json"
    if not path.exists() or path.stat().st_size == 0:
        response = ibge_http.get(f"https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf.upper()}/municipios", timeout=60)
        response.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(response.text, encoding="utf-8")
    return {_name_key(row["nome"]): (str(row["id"]), str(row["nome"])) for row in json.loads(path.read_text(encoding="utf-8"))}


def _name_key(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9]+", " ", text.casefold())
    return re.sub(r"\s+", " ", text).strip()


def _normalize_label(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"[^A-Za-z0-9]+", " ", text).strip().upper()
    return re.sub(r"\s+", " ", text)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Baixa o Sinesp VDE e extrai uma ou mais UFs.")
    parser.add_argument("--uf", action="append", default=[], help="UF a extrair (repetivel)")
    parser.add_argument("--no-download", action="store_true")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    if not args.no_download:
        print("baixados:", download())
    for uf in args.uf:
        print(extract_uf(uf))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
