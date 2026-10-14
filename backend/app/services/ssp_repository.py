"""Dados oficiais de Sao Paulo: SSP-SP (portal Numeros sem Misterio) e complementos.

Fontes, todas publicas e sem autenticacao:

* SSP-SP, ``v1/OcorrenciasMensais/RecuperaDadosMensaisAgrupados``: ocorrencias mensais por natureza,
  grupos "Criminal" (6) e "Produtividade policial" (9), por estado, municipio e distrito policial,
  desde janeiro de 2001. Uma chamada devolve um ano de um territorio e de um grupo.
* SSP-SP, ``v1/ViolenciaMulher/RecuperaDadosPorAno``: violencia contra a mulher no estado, com
  feminicidio mensal desde 2018.
* MJSP, Sinesp VDE (``bancovde-AAAA.xlsx``): morte por intervencao de agente do Estado. Para Sao Paulo
  a base so traz o total estadual (municipio "NAO INFORMADO"), mensal desde 2015.

As respostas brutas ficam em ``data/raw/ssp_sp/monthly`` (uma por chamada, ignoradas pelo git) e sao
consolidadas em ``data/raw/ssp_sp/ssp_monthly.csv.gz`` (versionado), so com as naturezas usadas pelo
site. Anos fechados nao mudam: a rodada diaria so baixa de novo o ano corrente (e o anterior ate
marco), a no maximo uma chamada por segundo.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import time
import unicodedata
from calendar import monthrange
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

import httpx
import pandas as pd

from app.config import settings
from app.etl import ibge_http
from app.services import sinesp_repository

logger = logging.getLogger(__name__)

OFFICIAL_SOURCE_NAME = "SSP-SP"
STATE_NAME = "Estado de São Paulo"
CAPITAL_NAME = "São Paulo"
FIRST_YEAR = 2001
SSP_BASE_URL = "https://www.ssp.sp.gov.br"
SSP_MONTHLY_URL = f"{SSP_BASE_URL}/v1/OcorrenciasMensais/RecuperaDadosMensaisAgrupados"
SSP_MUNICIPALITIES_URL = f"{SSP_BASE_URL}/v1/Municipios/RecuperaMunicipios"
SSP_DISTRICTS_URL = f"{SSP_BASE_URL}/v1/Distritos/RecuperaDistritos"
SSP_WOMEN_URL = f"{SSP_BASE_URL}/v1/ViolenciaMulher/RecuperaDadosPorAno"
SSP_CAPITAL_ID = 565
REQUEST_INTERVAL_S = 1.0
GROUPS = (6, 9)
TIPO = {"state": "ESTADO", "municipality": "MUNICÍPIO", "police_area": "DISTRITO"}
MONTHS = (
    "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
)

# Natureza da SSP (rotulo normalizado) -> indicador do site. Homicidio e latrocinio contam vitimas,
# como no ISP; as demais naturezas contam ocorrencias, que e o que a SSP publica.
INDICATOR_BY_LABEL = {
    "NO DE VITIMAS EM HOMICIDIO DOLOSO": "homicidio_doloso",
    "NO DE VITIMAS EM LATROCINIO": "latrocinio",
    "LESAO CORPORAL SEGUIDA DE MORTE": "lesao_corp_morte",
    "TOTAL DE ESTUPRO": "estupro",
    "ROUBO DE VEICULO": "roubo_veiculo",
    "ROUBO DE CARGA": "roubo_carga",
    "NO DE ARMAS DE FOGO APREENDIDAS": "apreensao_armas",
}
# "TOTAL DE ROUBO - OUTROS" inclui roubo de carga e roubo a banco (2024: 193.658 = 188.945 + 4.711 + 2).
# Roubo (outros) do site e o total menos carga e banco, a mesma conta em todos os anos; a linha
# "ROUBO - OUTROS" so existe em alguns anos.
ROBBERY_TOTAL_LABEL = "TOTAL DE ROUBO OUTROS"
ROBBERY_BANK_LABEL = "ROUBO A BANCO"
# A SSP passou a separar lesao corporal seguida de morte em setembro de 2016; antes a linha vem
# zerada (2001-2009, jan-ago/2016) ou ausente (2010-2015). Esses meses ficam sem dado.
LCSM_FIRST_MONTH = (2016, 9)

CONSOLIDATED_COLUMNS = ["source", "territory_type", "territory_id", "territory_name", "indicator", "year", "month", "value"]
WOMEN_FIRST_YEAR = 2018
STATS_COLUMNS = [
    "source_name", "territory_type", "territory_name", "police_area_name", "ibge_code",
    "year", "month", "period_date", "indicator", "value",
]


def raw_dir() -> Path:
    return (settings.data_dir / "raw" / "ssp_sp").resolve()


def consolidated_path() -> Path:
    return raw_dir() / "ssp_monthly.csv.gz"


# --- Download -------------------------------------------------------------------------------


class _Throttle:
    def __init__(self, interval: float) -> None:
        self.interval = interval
        self.last = 0.0
        self.count = 0

    def wait(self) -> None:
        delay = self.last + self.interval - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        self.last = time.monotonic()
        self.count += 1


def _get_json(client: httpx.Client, throttle: _Throttle, url: str, params: dict[str, Any] | None = None) -> Any:
    last_error: Exception | None = None
    for attempt in range(5):
        throttle.wait()
        try:
            response = client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            last_error = exc
            logger.warning("SSP-SP %s %s tentativa %s: %s", url, params, attempt + 1, exc)
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"SSP-SP falhou: {url} {params}") from last_error


def _cached_json(path: Path, fetch: Any, refresh: bool) -> Any:
    if path.exists() and path.stat().st_size > 0 and not refresh:
        return json.loads(path.read_text(encoding="utf-8"))
    payload = fetch()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)
    return payload


def municipalities(client: httpx.Client | None = None, throttle: _Throttle | None = None) -> list[dict[str, Any]]:
    path = raw_dir() / "municipios.json"
    with _client(client) as own:
        payload = _cached_json(path, lambda: _get_json(own, throttle or _Throttle(REQUEST_INTERVAL_S), SSP_MUNICIPALITIES_URL), False)
    return [row for row in payload.get("data", []) if row.get("codMunicipio") and row.get("nome")]


def capital_districts(client: httpx.Client | None = None, throttle: _Throttle | None = None) -> list[dict[str, Any]]:
    """Distritos policiais numerados da capital (``001 DP - Se`` ... ``103 DP - Cohab Itaquera``)."""

    path = raw_dir() / "distritos.json"
    with _client(client) as own:
        payload = _cached_json(path, lambda: _get_json(own, throttle or _Throttle(REQUEST_INTERVAL_S), SSP_DISTRICTS_URL), False)
    return [
        row
        for row in payload.get("data", [])
        if row.get("idMunicipio") == SSP_CAPITAL_ID and re.match(r"^\d{3} DP - ", str(row.get("sigla") or ""))
    ]


class _client:
    """Context manager that reuses a given client or opens a short-lived one."""

    def __init__(self, client: httpx.Client | None) -> None:
        self.given = client
        self.own: httpx.Client | None = None

    def __enter__(self) -> httpx.Client:
        if self.given is not None:
            return self.given
        self.own = httpx.Client(timeout=httpx.Timeout(60, connect=30), follow_redirects=True, headers=_HEADERS)
        return self.own

    def __exit__(self, *exc: object) -> None:
        if self.own is not None:
            self.own.close()


_HEADERS = {"User-Agent": "perdeu-playboy/1.0 (+https://g0v.tomoyo.systems/perdeu-playboy/sp/)"}


def _monthly_cache_path(territory_type: str, territory_id: int, year: int, group: int) -> Path:
    return raw_dir() / "monthly" / f"{territory_type}_{territory_id}_{year}_{group}.json"


def refresh_years(today: date | None = None) -> set[int]:
    """Anos baixados de novo a cada rodada: o corrente e, ate marco, o anterior."""

    today = today or date.today()
    years = {today.year}
    if today.month <= 3:
        years.add(today.year - 1)
    return years


def download(
    end_year: int | None = None,
    refresh: Iterable[int] | None = None,
    budget: int | None = None,
    territory_types: Iterable[str] = ("state", "police_area", "municipality"),
) -> int:
    """Baixa o que falta (e os anos em ``refresh``) a uma chamada por segundo; devolve as chamadas feitas.

    O que ja esta no consolidado versionado nao e baixado de novo, salvo os anos em ``refresh``.
    ``budget`` limita o numero de chamadas; o que nao couber fica para a proxima rodada.
    """

    end_year = end_year or date.today().year
    refresh_set = set(refresh if refresh is not None else refresh_years())
    covered = _consolidated_coverage()
    throttle = _Throttle(REQUEST_INTERVAL_S)
    years = list(range(end_year, FIRST_YEAR - 1, -1))
    with _client(None) as client:
        targets: list[tuple[str, int]] = []
        types = list(territory_types)
        if "state" in types:
            targets.append(("state", 0))
        if "police_area" in types:
            targets.extend(("police_area", int(row["idDistrito"])) for row in capital_districts(client, throttle))
        if "municipality" in types:
            targets.extend(("municipality", int(row["codMunicipio"])) for row in municipalities(client, throttle))
        for year in years:
            for territory_type, territory_id in targets:
                for group in GROUPS:
                    path = _monthly_cache_path(territory_type, territory_id, year, group)
                    if year in refresh_set:
                        if not _older_than_hours(path, 20):
                            continue
                    elif (path.exists() and path.stat().st_size > 0) or (f"ssp{group}", territory_type, territory_id, year) in covered:
                        continue
                    if budget is not None and throttle.count >= budget:
                        logger.warning("SSP-SP: limite de %s chamadas atingido", budget)
                        return throttle.count
                    params = {"ano": year, "grupoDelito": group, "tipoGrupo": TIPO[territory_type], "idGrupo": territory_id}
                    _cached_json(path, lambda p=params: _get_json(client, throttle, SSP_MONTHLY_URL, p), True)
        if "state" in types:
            for year in range(WOMEN_FIRST_YEAR, end_year + 1):
                path = raw_dir() / "mulher" / f"{year}.json"
                if year in refresh_set:
                    if not _older_than_hours(path, 20):
                        continue
                elif (path.exists() and path.stat().st_size > 0) or ("mulher", "state", 0, year) in covered:
                    continue
                _cached_json(path, lambda y=year: _get_json(client, throttle, SSP_WOMEN_URL, {"ano": y}), True)
    return throttle.count


def _older_than_hours(path: Path, hours: float) -> bool:
    if not path.exists():
        return True
    return (time.time() - path.stat().st_mtime) > hours * 3600


# --- Consolidacao ----------------------------------------------------------------------------


def _read_consolidated() -> pd.DataFrame:
    path = consolidated_path()
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame(columns=CONSOLIDATED_COLUMNS)
    return pd.read_csv(path)


def _consolidated_coverage() -> set[tuple[str, str, int, int]]:
    frame = _read_consolidated()
    if frame.empty:
        return set()
    keys = frame[["source", "territory_type", "territory_id", "year"]].drop_duplicates()
    return {(str(a), str(b), int(c), int(d)) for a, b, c, d in keys.itertuples(index=False)}


def consolidate() -> Path:
    """Junta as respostas brutas ao CSV consolidado (so naturezas usadas), versionado no repositorio.

    Cada linha do consolidado vem de uma chamada (fonte, territorio, ano); uma resposta bruta nova
    substitui as linhas da mesma chamada, e o resto do consolidado fica como estava.
    """

    names = {("state", 0): STATE_NAME}
    official = municipality_official_names()
    for row in municipalities():
        name = str(row["nome"]).strip()
        names[("municipality", int(row["codMunicipio"]))] = official.get(name, name)
    for row in capital_districts():
        names[("police_area", int(row["idDistrito"]))] = district_name(str(row["sigla"]))

    records: list[dict[str, object]] = []
    for path in sorted((raw_dir() / "monthly").glob("*.json")):
        match = re.match(r"^(state|municipality|police_area)_(\d+)_(\d{4})_(\d+)\.json$", path.name)
        if not match:
            continue
        territory_type, territory_id, year = match.group(1), int(match.group(2)), int(match.group(3))
        source = f"ssp{match.group(4)}"
        found = names.get((territory_type, territory_id))
        if not found:
            continue
        name = found
        payload = json.loads(path.read_text(encoding="utf-8"))
        records.append(_coverage_marker(source, territory_type, territory_id, name, year))
        records.extend(_records_from_payload(payload, territory_type, territory_id, name, year, source))

    for path in sorted((raw_dir() / "mulher").glob("*.json")):
        year = int(path.stem)
        payload = json.loads(path.read_text(encoding="utf-8"))
        records.append(_coverage_marker("mulher", "state", 0, STATE_NAME, year))
        for month_block in payload.get("data") or []:
            for item in month_block.get("dadosMes") or []:
                if _normalize_label((item.get("delito") or {}).get("delito", "")) == "FEMINICIDIO":
                    records.append(_record("mulher", "state", 0, STATE_NAME, "feminicidio", year, int(month_block["mes"]), item.get("total")))

    # Morte por intervencao de agente do Estado: total estadual do Sinesp VDE (ver sinesp_repository).
    sinesp_path = sinesp_repository.extract_path("SP")
    if sinesp_path.exists():
        vde = pd.read_csv(sinesp_path)
        # Meses depois do ultimo publicado vem zerados no VDE: corta no ultimo mes com homicidio.
        homicides = vde[vde["indicator"] == "homicidio_doloso"].groupby(["year", "month"])["value"].sum()
        homicides = homicides[homicides > 0]
        if not homicides.empty:
            last = homicides.index.max()
            vde = vde[[(int(y), int(m)) <= last for y, m in zip(vde["year"], vde["month"])]]
        vde = vde[vde["indicator"] == "morte_interv_policial"].groupby(["year", "month"], as_index=False)["value"].sum()
        for year in sorted(vde["year"].unique()):
            records.append(_coverage_marker("sinesp", "state", 0, STATE_NAME, int(year)))
        for row in vde.to_dict(orient="records"):
            records.append(_record("sinesp", "state", 0, STATE_NAME, "morte_interv_policial", int(row["year"]), int(row["month"]), row["value"]))

    fresh = pd.DataFrame(records, columns=CONSOLIDATED_COLUMNS)
    existing = _read_consolidated()
    if not existing.empty and not fresh.empty:
        key = ["source", "territory_type", "territory_id", "year"]
        replaced = fresh[key].drop_duplicates().assign(_replaced=True)
        existing = existing.merge(replaced, on=key, how="left")
        existing = existing[existing["_replaced"].isna()].drop(columns="_replaced")
    frame = pd.concat([existing, fresh], ignore_index=True) if not existing.empty else fresh
    frame["territory_id"] = frame["territory_id"].astype(int)
    frame["year"] = frame["year"].astype(int)
    frame["month"] = frame["month"].astype(int)
    frame = frame.sort_values(["source", "territory_type", "territory_id", "indicator", "year", "month"])
    path = consolidated_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False, compression={"method": "gzip", "mtime": 0})
    _stats_frame.cache_clear()
    return path


def _coverage_marker(source: str, territory_type: str, territory_id: int, name: str, year: int) -> dict[str, object]:
    """Linha sem valor que registra que a chamada foi feita, mesmo quando a resposta veio vazia."""

    return _record(source, territory_type, territory_id, name, "_coleta", year, 0, None)


def _records_from_payload(
    payload: dict[str, Any], territory_type: str, territory_id: int, name: str, year: int, source: str
) -> list[dict[str, object]]:
    by_indicator: dict[str, dict[str, Any]] = {}
    by_label: dict[str, dict[str, Any]] = {}
    for section in payload.get("data") or []:
        for item in section.get("listaDados") or []:
            label = _normalize_label((item.get("delito") or {}).get("delito", ""))
            by_label[label] = item
            if label in INDICATOR_BY_LABEL:
                by_indicator[INDICATOR_BY_LABEL[label]] = item
    if year < LCSM_FIRST_MONTH[0]:
        by_indicator.pop("lesao_corp_morte", None)
    total = by_label.get(ROBBERY_TOTAL_LABEL)
    if total is not None:
        derived = dict(total)
        for part in (by_label.get("ROUBO DE CARGA"), by_label.get(ROBBERY_BANK_LABEL)):
            if part is None:
                continue
            for column in MONTHS:
                derived[column] = float(derived.get(column) or 0) - float(part.get(column) or 0)
        by_indicator["roubo_outros"] = derived

    output: list[dict[str, object]] = []
    for indicator, item in by_indicator.items():
        # "publicado" e o numero de meses ja divulgados no ano; os demais ficam sem dado, nao zero.
        published = int(item.get("publicado") or 0)
        for month_index, column in enumerate(MONTHS, start=1):
            if month_index > published:
                break
            if indicator == "lesao_corp_morte" and (year, month_index) < LCSM_FIRST_MONTH:
                continue
            output.append(_record(source, territory_type, territory_id, name, indicator, year, month_index, item.get(column)))
    return output


def _record(
    source: str, territory_type: str, territory_id: int, name: str, indicator: str, year: int, month: int, value: object
) -> dict[str, object]:
    number = pd.to_numeric(value, errors="coerce") if value is not None else float("nan")
    return {
        "source": source,
        "territory_type": territory_type,
        "territory_id": territory_id,
        "territory_name": name,
        "indicator": indicator,
        "year": year,
        "month": month,
        "value": float(number) if pd.notna(number) else None,
    }


def district_name(sigla: str) -> str:
    """``'078 DP - Jardins'`` -> ``'78º DP Jardins'``."""

    match = re.match(r"^(\d{3}) DP - (.+)$", sigla.strip())
    if not match:
        return sigla.strip()
    return f"{int(match.group(1))}º DP {match.group(2).strip()}"


# --- Leitura (mesma interface do isp_repository) -------------------------------------------


@lru_cache(maxsize=4)
def _stats_frame(territory_type: str) -> pd.DataFrame:
    path = consolidated_path()
    if not path.exists():
        raise FileNotFoundError(f"{path} ausente; rode python -m app.services.ssp_repository --download")
    frame = pd.read_csv(path)
    frame = frame[(frame["territory_type"] == territory_type) & (frame["indicator"] != "_coleta")].dropna(subset=["value"])
    # O 9o DP aparece com dois identificadores no portal; as duas series somam-se pelo nome.
    frame = frame.groupby(["territory_name", "indicator", "year", "month"], as_index=False)["value"].sum()
    frame["year"] = frame["year"].astype(int)
    frame["month"] = frame["month"].astype(int)
    frame["source_name"] = OFFICIAL_SOURCE_NAME
    frame["territory_type"] = territory_type
    frame["police_area_name"] = None
    frame["ibge_code"] = frame["territory_name"].map(municipality_ibge_codes()) if territory_type == "municipality" else None
    frame = pd.concat([frame, _lethality(frame)], ignore_index=True)
    frame["period_date"] = [date(year, month, monthrange(year, month)[1]) for year, month in zip(frame["year"], frame["month"])]
    return frame.loc[:, STATS_COLUMNS].reset_index(drop=True)


LETHALITY_COMPONENTS = ("homicidio_doloso", "latrocinio", "lesao_corp_morte", "morte_interv_policial")


def _lethality(frame: pd.DataFrame) -> pd.DataFrame:
    """Letalidade violenta, como no ISP: soma dos quatro componentes, so nos meses em que todos tem dado.

    Em SP a morte por intervencao de agente do Estado so existe para o estado (Sinesp VDE, desde 2015),
    entao a letalidade tambem so existe para o estado.
    """

    parts = frame[frame["indicator"].isin(LETHALITY_COMPONENTS)]
    if parts.empty:
        return frame.iloc[0:0]
    keys = ["territory_name", "year", "month"]
    grouped = parts.groupby(keys).agg(value=("value", "sum"), components=("indicator", "nunique")).reset_index()
    grouped = grouped[grouped["components"] == len(LETHALITY_COMPONENTS)].drop(columns="components")
    template = parts.drop_duplicates("territory_name").set_index("territory_name")
    grouped["indicator"] = "letalidade_violenta"
    for column in ("source_name", "territory_type", "police_area_name", "ibge_code"):
        grouped[column] = grouped["territory_name"].map(template[column])
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


@lru_cache(maxsize=1)
def municipality_ibge_codes() -> dict[str, str]:
    """Nome oficial (IBGE) do municipio -> codigo IBGE."""

    return {name: code for code, name in _ibge_localities().items()}


@lru_cache(maxsize=1)
def municipality_official_names() -> dict[str, str]:
    """Nome do municipio na SSP -> nome no IBGE, casando sem acento; tres grafias tem alias."""

    by_key = {_name_key(name): name for name in _ibge_localities().values()}
    output: dict[str, str] = {}
    for row in municipalities():
        name = str(row["nome"]).strip()
        official = by_key.get(_name_key(MUNICIPALITY_ALIASES.get(name, name)))
        if official:
            output[name] = official
    return output


@lru_cache(maxsize=1)
def _ibge_localities() -> dict[str, str]:
    """Codigo IBGE -> nome dos 645 municipios de SP (API de localidades do IBGE)."""

    path = settings.data_dir / "raw" / "ibge" / "localidades_sp_municipios.json"
    if not path.exists() or path.stat().st_size == 0:
        response = ibge_http.get("https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios", timeout=60)
        response.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(response.text, encoding="utf-8")
    return {str(row["id"]): str(row["nome"]) for row in json.loads(path.read_text(encoding="utf-8"))}


# Grafias da SSP que diferem do IBGE.
MUNICIPALITY_ALIASES: dict[str, str] = {
    "Florínia": "Florínea",
    "Santa Rosa do Viterbo": "Santa Rosa de Viterbo",
    "São Luís do Paraitinga": "São Luiz do Paraitinga",
}


def _name_key(value: str) -> str:
    text = unicodedata.normalize("NFKD", value)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9]+", " ", text.casefold())
    return re.sub(r"\s+", " ", text).strip()


def _normalize_label(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = text.replace("º", "O").replace("°", "O")
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"[^A-Za-z0-9]+", " ", text).strip().upper()
    return re.sub(r"\s+", " ", text)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Baixa e consolida os dados mensais da SSP-SP.")
    parser.add_argument("--download", action="store_true", help="baixa o que falta e o ano corrente")
    parser.add_argument("--budget", type=int, help="maximo de chamadas a SSP nesta rodada")
    parser.add_argument("--types", default="state,police_area,municipality")
    parser.add_argument("--no-sinesp", action="store_true")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    if args.download:
        made = download(budget=args.budget, territory_types=args.types.split(","))
        logger.info("SSP-SP: %s chamadas em %s", made, datetime.now().isoformat(timespec="seconds"))
        if not args.no_sinesp:
            sinesp_repository.download()
    if not args.no_sinesp:
        sinesp_repository.extract_uf("SP")
    print(consolidate())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
