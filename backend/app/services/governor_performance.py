from __future__ import annotations

from datetime import date

import pandas as pd
from pydantic import BaseModel, ConfigDict

from app.schemas import GovernorPerformanceOut, GovernorPerformanceRow
from app.services import isp_repository
from app.services.indicator_catalog import INDICATOR_BY_CODE

SCORE_INDICATORS = [
    "homicidio_doloso",
    "lesao_corp_morte",
    "latrocinio",
    "letalidade_violenta",
    "morte_interv_policial",
    "feminicidio",
    "roubo_rua",
    "roubo_veiculo",
    "roubo_carga",
    "estupro",
]


class GovernorTerm(BaseModel):
    """Validated governor term used by the performance calculator."""

    model_config = ConfigDict(frozen=True)

    governor: str
    party_or_condition: str
    start: date
    end: date | None


GOVERNOR_TERMS = [
    GovernorTerm(
        governor="Leonel Brizola",
        party_or_condition="PDT",
        start=date(1991, 1, 1),
        end=date(1994, 12, 31),
    ),
    GovernorTerm(
        governor="Marcello Alencar",
        party_or_condition="PSDB",
        start=date(1995, 1, 1),
        end=date(1998, 12, 31),
    ),
    GovernorTerm(
        governor="Anthony Garotinho",
        party_or_condition="PDT",
        start=date(1999, 1, 1),
        end=date(2002, 4, 5),
    ),
    GovernorTerm(
        governor="Benedita da Silva",
        party_or_condition="em exercício",
        start=date(2002, 4, 6),
        end=date(2002, 12, 31),
    ),
    GovernorTerm(
        governor="Rosinha Garotinho",
        party_or_condition="PSB",
        start=date(2003, 1, 1),
        end=date(2006, 12, 31),
    ),
    GovernorTerm(
        governor="Sérgio Cabral",
        party_or_condition="PMDB",
        start=date(2007, 1, 1),
        end=date(2014, 4, 3),
    ),
    GovernorTerm(
        governor="Luiz Fernando Pezão",
        party_or_condition="PMDB",
        start=date(2014, 4, 4),
        end=date(2018, 12, 31),
    ),
    GovernorTerm(
        governor="Wilson Witzel",
        party_or_condition="PSC",
        start=date(2019, 1, 1),
        end=date(2020, 8, 27),
    ),
    GovernorTerm(
        governor="Cláudio Castro",
        party_or_condition="PSC/PL",
        start=date(2020, 8, 28),
        end=date(2026, 3, 23),
    ),
    GovernorTerm(
        governor="Ricardo Couto",
        party_or_condition="interino/em exercício",
        start=date(2026, 3, 24),
        end=None,
    ),
]


def governor_performance() -> GovernorPerformanceOut:
    latest_year, latest_month = isp_repository.latest_period()
    latest_date = pd.Timestamp(latest_year, latest_month, 1) + pd.offsets.MonthEnd(0)
    rows = [_term_performance(term, latest_date.date()) for term in GOVERNOR_TERMS]

    ranked = [row for row in rows if row.average_reduction_percent is not None]
    ranked.sort(key=lambda row: row.average_reduction_percent or float("-inf"), reverse=True)
    rank_by_governor = {row.governor: index for index, row in enumerate(ranked, start=1)}
    for row in rows:
        row.rank = rank_by_governor.get(row.governor)

    rows.sort(
        key=lambda row: (
            row.rank is None,
            row.rank if row.rank is not None else 999,
            row.term_start,
        )
    )
    return GovernorPerformanceOut(
        methodology=(
            "Ranking calculado com dados mensais estaduais do ISP. Para cada governador, compara a média mensal "
            "dos indicadores durante o período de governo com a média mensal dos 12 meses anteriores à posse. "
            "Percentual positivo significa redução média; mandatos curtos entram proporcionalmente pelo número de meses disponíveis."
        ),
        indicators=[INDICATOR_BY_CODE[indicator].name for indicator in SCORE_INDICATORS],
        rows=rows,
    )


def _term_performance(term: GovernorTerm, latest_date: date) -> GovernorPerformanceRow:
    term_end = min(term.end or latest_date, latest_date)
    if term.start > latest_date:
        return _empty_row(term, term_end, "Sem dados publicados para o período.")

    indicator_changes: dict[str, float] = {}
    current_values: list[float] = []
    baseline_values: list[float] = []
    months_count = 0
    baseline_months_count = 0

    for indicator in SCORE_INDICATORS:
        frame = isp_repository.rows(indicator, "state", "Estado do Rio de Janeiro")
        frame = frame.sort_values("period_date").copy()
        frame["period_date"] = pd.to_datetime(frame["period_date"]).dt.date
        current = frame[(frame["period_date"] >= term.start) & (frame["period_date"] <= term_end)]
        baseline = frame[frame["period_date"] < term.start].tail(12)

        if current.empty or baseline.empty:
            continue

        current_avg = float(current["value"].mean())
        baseline_avg = float(baseline["value"].mean())
        if baseline_avg <= 0:
            continue

        months_count = max(months_count, len(current))
        baseline_months_count = max(baseline_months_count, len(baseline))
        current_values.append(current_avg)
        baseline_values.append(baseline_avg)
        indicator_changes[indicator] = (baseline_avg - current_avg) / baseline_avg * 100

    if not indicator_changes:
        return _empty_row(term, term_end, "Sem linha de base suficiente nos dados do ISP.")

    best_indicator, best_value = max(indicator_changes.items(), key=lambda item: item[1])
    worst_indicator, worst_value = min(indicator_changes.items(), key=lambda item: item[1])
    note = None
    if months_count < 12:
        if months_count == 1:
            note = "Base curta: 1 mes disponivel no mandato."
        else:
            note = f"Base curta: {months_count} meses disponiveis no mandato."

    return GovernorPerformanceRow(
        rank=None,
        governor=term.governor,
        party_or_condition=term.party_or_condition,
        term_start=term.start,
        term_end=term.end,
        months_count=months_count,
        baseline_months_count=baseline_months_count,
        average_reduction_percent=round(sum(indicator_changes.values()) / len(indicator_changes), 1),
        annualized_current_value=round(sum(current_values) * 12, 1),
        annualized_baseline_value=round(sum(baseline_values) * 12, 1),
        best_indicator=f"{INDICATOR_BY_CODE[best_indicator].name} ({best_value:.1f}%)",
        worst_indicator=f"{INDICATOR_BY_CODE[worst_indicator].name} ({worst_value:.1f}%)",
        note=note,
    )


def _empty_row(term: GovernorTerm, term_end: date, note: str) -> GovernorPerformanceRow:
    return GovernorPerformanceRow(
        rank=None,
        governor=term.governor,
        party_or_condition=term.party_or_condition,
        term_start=term.start,
        term_end=term.end or term_end,
        months_count=0,
        baseline_months_count=0,
        note=note,
    )
