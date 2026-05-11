from __future__ import annotations

from collections import defaultdict

import pandas as pd

from app.constants import ANALYSIS_START_YEAR
from app.schemas import LatestPeriodOut, MapOut, RankingRow, SummaryCard, SummaryOut, TimeSeriesPoint
from app.services.indicator_catalog import INDICATORS
from app.services import isp_repository, population_repository


def latest_period() -> LatestPeriodOut:
    year, month = isp_repository.latest_period()
    period_date = pd.Timestamp(year, month, 1) + pd.offsets.MonthEnd(0)
    return LatestPeriodOut(
        year=year,
        month=month,
        period_date=period_date.date(),
        source_name=isp_repository.OFFICIAL_SOURCE_NAME,
    )


def get_summary(year: int, territory_type: str, territory_name: str | None) -> SummaryOut:
    latest = latest_period()
    cutoff_month = latest.month if year == latest.year else 12
    name = territory_name or _default_territory_name(territory_type)
    cards: list[SummaryCard] = []

    for indicator in INDICATORS:
        current = _ytd_value(indicator.code, territory_type, name, year, cutoff_month)
        previous = _ytd_value(indicator.code, territory_type, name, year - 1, cutoff_month)
        historical_min = _historical_min_ytd(indicator.code, territory_type, name, cutoff_month)
        diff = current - previous
        pct = _round_optional(diff / previous * 100) if previous else None
        sparkline_frame = isp_repository.rows(indicator.code, territory_type, name, year, year)
        sparkline = sparkline_frame.sort_values("month")["value"].astype(float).tolist()
        cards.append(
            SummaryCard(
                indicator=indicator.code,
                name=indicator.name,
                current_year_value=current,
                previous_year_same_period=previous,
                historical_min_same_period=historical_min[1] if historical_min else None,
                historical_min_year=historical_min[0] if historical_min else None,
                historical_min_times_lower=_times_lower(current, historical_min[1] if historical_min else None),
                yoy_absolute_change=diff,
                yoy_percent_change=pct,
                latest_month=cutoff_month,
                sparkline=sparkline,
            )
        )

    return SummaryOut(
        year=year,
        territory_type=territory_type,
        territory_name=name,
        latest_month=cutoff_month,
        cards=cards,
    )


def get_timeseries(
    indicator: str,
    territory_type: str,
    territory_name: str | None,
    start_year: int,
    end_year: int,
) -> list[TimeSeriesPoint]:
    name = territory_name or _default_territory_name(territory_type)
    start_year = max(start_year, ANALYSIS_START_YEAR)
    frame = isp_repository.rows(indicator, territory_type, name, start_year, end_year)
    if frame.empty:
        return []

    frame = frame.sort_values(["year", "month"]).copy()
    frame["moving_average"] = frame["value"].rolling(window=3, min_periods=1).mean().round(1)
    previous = frame[["year", "month", "value"]].rename(
        columns={"year": "previous_join_year", "value": "previous_year_value"}
    )
    previous["year"] = previous["previous_join_year"] + 1
    frame = frame.merge(
        previous[["year", "month", "previous_year_value"]],
        on=["year", "month"],
        how="left",
    )
    frame["yoy_percent_change"] = frame.apply(
        lambda row: (
            round((row["value"] - row["previous_year_value"]) / row["previous_year_value"] * 100, 1)
            if pd.notna(row["previous_year_value"]) and row["previous_year_value"] != 0
            else None
        ),
        axis=1,
    )

    points: list[TimeSeriesPoint] = []
    for row in frame.to_dict(orient="records"):
        points.append(
            TimeSeriesPoint(
                period_date=row["period_date"],
                year=int(row["year"]),
                month=int(row["month"]),
                indicator=indicator,
                territory_type=territory_type,
                territory_name=name,
                value=float(row["value"]),
                moving_average=_nullable_float(row.get("moving_average")),
                previous_year_value=_nullable_float(row.get("previous_year_value")),
                yoy_percent_change=_nullable_float(row.get("yoy_percent_change")),
                rate_per_100k=None,
            )
        )
    return points


def get_rankings(indicator: str, year: int, month: int, territory_type: str, mode: str) -> list[RankingRow]:
    current = isp_repository.ytd_rows(indicator, territory_type, year, month)
    previous = isp_repository.ytd_rows(indicator, territory_type, year - 1, month)
    if current.empty:
        return []

    current_grouped = _ranking_grouped(current, territory_type)
    previous_grouped = _ranking_grouped(previous, territory_type) if not previous.empty else pd.DataFrame()
    previous_by_key = {
        _ranking_key(row, territory_type): float(row["value"])
        for row in previous_grouped.to_dict(orient="records")
    }
    ranking_rows: list[RankingRow] = []

    for row in current_grouped.to_dict(orient="records"):
        name = str(row["territory_name"])
        value = float(row["value"])
        prev_value = previous_by_key.get(_ranking_key(row, territory_type), 0.0)
        diff = value - prev_value
        pct = _round_optional(diff / prev_value * 100) if prev_value else None
        population = (
            population_repository.population_for_municipality(
                ibge_code=row.get("ibge_code"),
                municipality_name=name,
            )
            if territory_type == "municipality"
            else None
        )
        ranking_rows.append(
            RankingRow(
                rank=0,
                territory_name=name,
                territory_type=territory_type,
                value=value,
                rate_per_100k=_rate_per_100k(value, population),
                yoy_absolute_change=diff,
                yoy_percent_change=pct,
            )
        )

    key = {
        "count": lambda row: row.value,
        "rate": lambda row: row.rate_per_100k or 0,
        "yoy": lambda row: row.yoy_percent_change if row.yoy_percent_change is not None else float("-inf"),
    }[mode]
    ranking_rows.sort(key=key, reverse=True)
    for idx, row in enumerate(ranking_rows, start=1):
        row.rank = idx
    return ranking_rows


def get_map(indicator: str, year: int, month: int, territory_type: str) -> MapOut:
    # Real geometries are not loaded yet. Do not synthesize shapes.
    return MapOut(features=[])


def get_territories(territory_type: str) -> list[str]:
    return isp_repository.territories(territory_type)


def methodology() -> dict:
    return {
        "title": "Metodologia",
        "source_summary": (
            "O painel usa CSVs oficiais do Instituto de Seguranca Publica do Estado do Rio de Janeiro "
            "baixados do portal ISPDados. Taxas municipais por 100 mil habitantes usam populacao oficial "
            "do IBGE/SIDRA."
        ),
        "update_frequency": "As series oficiais do ISP sao publicadas mensalmente; o app baixa e cacheia os CSVs oficiais localmente.",
        "limitations": [
            "Os dados do ISP sao baseados em registros policiais e podem nao representar todos os eventos reais.",
            "Mudancas de classificacao, fluxo administrativo ou atraso de consolidacao podem afetar comparacoes historicas.",
            "Taxas por 100 mil estao disponiveis para municipios quando ha codigo IBGE no dado do ISP; areas policiais ainda nao possuem denominador populacional carregado.",
            "Filtros por bairro usam a relacao oficial bairro/distrito-CISP do ISP; os indicadores sao agregados da CISP correspondente, nao ocorrencias geocodificadas no limite exato do bairro.",
            "Mapas reais exigem geometrias oficiais de municipios/CISP; shapes artificiais nao sao usados.",
            "Dados do Fogo Cruzado, se habilitados no futuro, descrevem eventos de disparo de arma de fogo e nao devem ser somados automaticamente aos registros policiais.",
        ],
        "definitions": {
            "homicidio_doloso": "Registro policial de morte intencional.",
            "letalidade_violenta": "Indicador agregado usualmente composto por homicidio doloso, latrocinio, lesao corporal seguida de morte e morte por intervencao de agente do Estado.",
            "morte_interv_policial": "Mortes decorrentes de intervencao de agentes do Estado, conforme registros oficiais.",
            "latrocinio": "Roubo seguido de morte.",
            "lesao_corp_morte": "Lesao corporal seguida de morte.",
            "feminicidio": "Homicidio de mulher por razoes da condicao de sexo feminino, nos termos da legislacao aplicavel.",
            "roubo": "Subtracao mediante violencia ou grave ameaca, conforme classificacao do registro policial.",
            "apreensao_armas": "Armas de fogo apreendidas, agregadas a partir da base oficial de armas do ISP.",
        },
        "ethical_notes": [
            "O dashboard evita identificacao de vitimas, enderecos privados e detalhes pessoais.",
            "Indicadores sao apresentados como informacao civica para transparencia, pesquisa e controle social.",
            "Textos e visualizacoes devem evitar linguagem inflamatoria ou ranking sensacionalista.",
        ],
    }


def _ytd_value(indicator: str, territory_type: str, territory_name: str, year: int, month: int) -> float:
    frame = isp_repository.ytd_rows(indicator, territory_type, year, month)
    if frame.empty:
        return 0.0
    frame = _filter_territory_frame(frame, territory_name)
    return float(frame["value"].sum())


def _historical_min_ytd(
    indicator: str,
    territory_type: str,
    territory_name: str,
    month: int,
) -> tuple[int, float] | None:
    frame = isp_repository.rows(indicator, territory_type, territory_name)
    if frame.empty:
        return None
    frame = frame[frame["year"] >= ANALYSIS_START_YEAR]
    frame = frame[frame["month"] <= month]
    if frame.empty:
        return None
    grouped = frame.groupby("year")["value"].sum().sort_values(kind="stable")
    # Some ISP variables were introduced after the beginning of the state series. A zero accumulated value in
    # the early wide table usually means "not available", not a real historical low.
    grouped = grouped[grouped > 0]
    if grouped.empty:
        return None
    min_year = int(grouped.idxmin())
    return min_year, float(grouped.loc[min_year])


def _default_territory_name(territory_type: str) -> str:
    if territory_type == "state":
        return "Estado do Rio de Janeiro"
    names = isp_repository.territories(territory_type)
    return names[0] if names else ""


def _nullable_float(value: object) -> float | None:
    if value is None or pd.isna(value):
        return None
    return float(value)


def _round_optional(value: float | None, digits: int = 1) -> float | None:
    if value is None:
        return None
    return round(float(value), digits)


def _times_lower(current: float, minimum: float | None) -> float | None:
    if minimum is None or minimum <= 0 or current <= 0:
        return None
    return round(current / minimum, 1)


def _filter_territory_frame(frame: pd.DataFrame, territory_name: str) -> pd.DataFrame:
    normalized = territory_name.casefold()
    mask = frame["territory_name"].str.casefold() == normalized
    if "police_area_name" in frame.columns:
        mask = mask | (frame["police_area_name"].fillna("").astype(str).str.casefold() == normalized)
    return frame[mask]


def _ranking_grouped(frame: pd.DataFrame, territory_type: str) -> pd.DataFrame:
    group_columns = ["territory_name"]
    if territory_type == "municipality" and "ibge_code" in frame.columns:
        group_columns.append("ibge_code")
    return frame.groupby(group_columns, dropna=False, as_index=False)["value"].sum()


def _ranking_key(row: dict, territory_type: str) -> str:
    if territory_type == "municipality":
        code = row.get("ibge_code")
        if code is not None and not pd.isna(code) and str(code).strip():
            return str(code).strip()
    return str(row["territory_name"]).casefold()


def _rate_per_100k(value: float, population: float | None) -> float | None:
    if population is None or population <= 0:
        return None
    return round(value / population * 100_000, 1)
