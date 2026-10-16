"""Brasil: o pais no papel do estado e as 27 UFs no papel dos municipios, todos pelo Sinesp VDE.

Cada UF sai do extrato do Sinesp VDE (``data/raw/sinesp/<uf>_vde.csv.gz``), o mesmo que alimenta o
snapshot das UFs sem fonte propria, com o mesmo corte (o ultimo mes com homicidio no estado). Rio de
Janeiro e Sao Paulo tambem vem do Sinesp, e nao do ISP e da SSP-SP: as fontes estaduais contam de outro
jeito (a SSP-SP conta ocorrencias onde o Sinesp conta vitimas; o ISP soma roubo de rua, que o Sinesp nao
tem) e a soma de fontes diferentes nao seria uma serie nacional.

Regra do total nacional: um indicador num mes so tem valor quando as 27 UFs tem linha para ele naquele
mes. Se uma UF nao mandou o dado, o total do pais fica sem dado, nunca a soma das outras 26. Zero enviado
pela UF e zero; linha ausente e sem dado.

Mesma interface do ``isp_repository``: :func:`rows`, :func:`territories`, :func:`latest_period`. O tipo
``municipality`` devolve as UFs (pelo nome, "Rio de Janeiro"), ``state`` devolve o Brasil.
"""

from __future__ import annotations

import argparse
from calendar import monthrange
from datetime import date
from functools import lru_cache

import pandas as pd

from app.services import sinesp_repository
from app.uf import all_ufs, country

OFFICIAL_SOURCE_NAME = "Sinesp VDE/MJSP (27 UFs)"
STATS_COLUMNS = sinesp_repository.STATS_COLUMNS


def uf_codes() -> list[str]:
    """As 27 UFs, na ordem de ``ufs.json``, publicadas ou nao."""

    return [uf.code for uf in all_ufs().values() if uf.source != "brasil"]


def uf_names() -> dict[str, str]:
    """Sigla -> nome da UF ("RJ" -> "Rio de Janeiro"), o nome dos territorios do nivel UF."""

    return {code: all_ufs()[code].name for code in uf_codes()}


def extract_missing() -> list[str]:
    """Gera o extrato do Sinesp das UFs que ainda nao o tem (o Rio, servido pelo ISP, e o caso comum)."""

    done = []
    for code in uf_codes():
        if not sinesp_repository.extract_path(code).exists():
            sinesp_repository.extract_uf(code)
            done.append(code)
    return done


@lru_cache(maxsize=1)
def _uf_frame() -> pd.DataFrame:
    frames = []
    for code in uf_codes():
        frame = sinesp_repository._stats_frame_for(code, "state").copy()
        frame["territory_name"] = all_ufs()[code].name
        frame["ibge_code"] = str(all_ufs()[code].ibge_code)
        frame["uf"] = code
        frames.append(frame)
    output = pd.concat(frames, ignore_index=True)
    output["territory_type"] = "municipality"
    output["source_name"] = OFFICIAL_SOURCE_NAME
    return output


@lru_cache(maxsize=1)
def _country_frame() -> pd.DataFrame:
    frame = _uf_frame()
    total = len(uf_codes())
    grouped = (
        frame.groupby(["indicator", "year", "month"], as_index=False)
        .agg(value=("value", "sum"), ufs=("uf", "nunique"))
    )
    grouped = grouped[grouped["ufs"] == total].drop(columns="ufs")
    grouped["territory_name"] = country().state_name
    grouped["ibge_code"] = str(country().ibge_code)
    grouped["source_name"] = OFFICIAL_SOURCE_NAME
    grouped["territory_type"] = "state"
    grouped["police_area_name"] = None
    grouped["year"] = grouped["year"].astype(int)
    grouped["month"] = grouped["month"].astype(int)
    grouped["period_date"] = [date(y, m, monthrange(y, m)[1]) for y, m in zip(grouped["year"], grouped["month"])]
    return grouped.loc[:, STATS_COLUMNS].reset_index(drop=True)


def _stats_frame(territory_type: str) -> pd.DataFrame:
    if territory_type == "state":
        return _country_frame()
    if territory_type == "municipality":
        return _uf_frame().loc[:, STATS_COLUMNS]
    return pd.DataFrame(columns=STATS_COLUMNS)


def latest_period() -> tuple[int, int]:
    frame = _country_frame()
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


def coverage_gaps() -> dict[str, dict[str, list[str]]]:
    """Por indicador, os meses sem total nacional e as UFs que faltam em cada um (para conferencia)."""

    frame = _uf_frame()
    codes = set(uf_codes())
    output: dict[str, dict[str, list[str]]] = {}
    for (indicator, year, month), group in frame.groupby(["indicator", "year", "month"]):
        missing = sorted(codes - set(group["uf"]))
        if missing:
            output.setdefault(str(indicator), {})[f"{int(year):04d}-{int(month):02d}"] = missing
    return output


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Extrai do Sinesp as UFs que faltam e resume a cobertura nacional.")
    parser.parse_args(argv)
    print("extraidas:", extract_missing())
    for indicator, months in sorted(coverage_gaps().items()):
        keys = sorted(months)
        ufs = sorted({uf for missing in months.values() for uf in missing})
        print(f"{indicator}: {len(keys)} meses sem total ({keys[0]} a {keys[-1]}); UFs: {', '.join(ufs)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
