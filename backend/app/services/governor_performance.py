from __future__ import annotations

from datetime import date

import pandas as pd
from pydantic import BaseModel, ConfigDict

from app.schemas import GovernorPerformanceOut, GovernorPerformanceRow
from app.services.indicator_catalog import INDICATOR_BY_CODE
from app.uf import current as current_uf, repository

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


# Prefeitos da cidade do Rio de Janeiro desde 1989, para as faixas de mandato quando o recorte
# e o municipio do Rio ou uma de suas areas integradas. Nao entram no ranking de desempenho.
MAYOR_TERMS: dict[str, list[GovernorTerm]] = {
    "Rio de Janeiro": [
        GovernorTerm(governor="Marcello Alencar", party_or_condition="PDT", start=date(1989, 1, 1), end=date(1992, 12, 31)),
        GovernorTerm(governor="César Maia", party_or_condition="PMDB", start=date(1993, 1, 1), end=date(1996, 12, 31)),
        GovernorTerm(governor="Luiz Paulo Conde", party_or_condition="PFL", start=date(1997, 1, 1), end=date(2000, 12, 31)),
        GovernorTerm(governor="César Maia", party_or_condition="PTB / PFL / DEM", start=date(2001, 1, 1), end=date(2008, 12, 31)),
        GovernorTerm(governor="Eduardo Paes", party_or_condition="PMDB", start=date(2009, 1, 1), end=date(2016, 12, 31)),
        GovernorTerm(governor="Marcelo Crivella", party_or_condition="PRB / Republicanos", start=date(2017, 1, 1), end=date(2020, 12, 31)),
        GovernorTerm(governor="Eduardo Paes", party_or_condition="DEM / PSD", start=date(2021, 1, 1), end=None),
    ],
}


# Governadores de Sao Paulo desde o inicio da serie da SSP (2001). Datas de posse e saida conforme a
# lista de governantes do estado (Covas morreu em 6/3/2001; Alckmin, Serra, Alckmin e Doria renunciaram
# para disputar eleicoes; Tarcisio foi reeleito em 4/10/2026).
SP_GOVERNOR_TERMS = [
    GovernorTerm(governor="Mário Covas", party_or_condition="PSDB", start=date(1995, 1, 1), end=date(2001, 3, 5)),
    GovernorTerm(governor="Geraldo Alckmin", party_or_condition="PSDB", start=date(2001, 3, 6), end=date(2006, 3, 30)),
    GovernorTerm(governor="Cláudio Lembo", party_or_condition="PFL", start=date(2006, 3, 31), end=date(2006, 12, 31)),
    GovernorTerm(governor="José Serra", party_or_condition="PSDB", start=date(2007, 1, 1), end=date(2010, 4, 1)),
    GovernorTerm(governor="Alberto Goldman", party_or_condition="PSDB", start=date(2010, 4, 2), end=date(2010, 12, 31)),
    GovernorTerm(governor="Geraldo Alckmin", party_or_condition="PSDB", start=date(2011, 1, 1), end=date(2018, 4, 5)),
    GovernorTerm(governor="Márcio França", party_or_condition="PSB", start=date(2018, 4, 6), end=date(2018, 12, 31)),
    GovernorTerm(governor="João Doria", party_or_condition="PSDB", start=date(2019, 1, 1), end=date(2022, 3, 31)),
    GovernorTerm(governor="Rodrigo Garcia", party_or_condition="PSDB", start=date(2022, 4, 1), end=date(2022, 12, 31)),
    GovernorTerm(governor="Tarcísio de Freitas", party_or_condition="Republicanos", start=date(2023, 1, 1), end=None),
]

# Prefeitos da cidade de Sao Paulo desde 2001.
SP_MAYOR_TERMS: dict[str, list[GovernorTerm]] = {
    "São Paulo": [
        GovernorTerm(governor="Marta Suplicy", party_or_condition="PT", start=date(2001, 1, 1), end=date(2004, 12, 31)),
        GovernorTerm(governor="José Serra", party_or_condition="PSDB", start=date(2005, 1, 1), end=date(2006, 3, 30)),
        GovernorTerm(governor="Gilberto Kassab", party_or_condition="PFL / DEM / PSD", start=date(2006, 3, 31), end=date(2012, 12, 31)),
        GovernorTerm(governor="Fernando Haddad", party_or_condition="PT", start=date(2013, 1, 1), end=date(2016, 12, 31)),
        GovernorTerm(governor="João Doria", party_or_condition="PSDB", start=date(2017, 1, 1), end=date(2018, 4, 5)),
        GovernorTerm(governor="Bruno Covas", party_or_condition="PSDB", start=date(2018, 4, 6), end=date(2021, 5, 15)),
        GovernorTerm(governor="Ricardo Nunes", party_or_condition="MDB", start=date(2021, 5, 16), end=None),
    ],
}

# Minas Gerais (UF de teste da fonte Sinesp VDE, serie desde 2015). Zema renunciou em 22/3/2026.
MG_GOVERNOR_TERMS = [
    GovernorTerm(governor="Fernando Pimentel", party_or_condition="PT", start=date(2015, 1, 1), end=date(2018, 12, 31)),
    GovernorTerm(governor="Romeu Zema", party_or_condition="Novo", start=date(2019, 1, 1), end=date(2026, 3, 21)),
    GovernorTerm(governor="Mateus Simões", party_or_condition="PSD", start=date(2026, 3, 22), end=None),
]
MG_MAYOR_TERMS: dict[str, list[GovernorTerm]] = {
    "Belo Horizonte": [
        GovernorTerm(governor="Marcio Lacerda", party_or_condition="PSB", start=date(2009, 1, 1), end=date(2016, 12, 31)),
        GovernorTerm(governor="Alexandre Kalil", party_or_condition="PHS / PSD", start=date(2017, 1, 1), end=date(2022, 3, 28)),
        GovernorTerm(governor="Fuad Noman", party_or_condition="PSD", start=date(2022, 3, 29), end=date(2025, 3, 25)),
        GovernorTerm(governor="Álvaro Damião", party_or_condition="União Brasil", start=date(2025, 3, 26), end=None),
    ],
}

# Mandatos por UF. Uma UF publicada sem entrada aqui fica com a tela Mandatos vazia ate alguem
# acrescentar as datas verificadas.
GOVERNOR_TERMS_BY_UF: dict[str, list[GovernorTerm]] = {"RJ": GOVERNOR_TERMS, "SP": SP_GOVERNOR_TERMS, "MG": MG_GOVERNOR_TERMS}
MAYOR_TERMS_BY_UF: dict[str, dict[str, list[GovernorTerm]]] = {"RJ": MAYOR_TERMS, "SP": SP_MAYOR_TERMS, "MG": MG_MAYOR_TERMS}


SOURCE_PHRASE = {"isp": "do ISP", "ssp": "da SSP-SP"}


def _indicator_name(code: str) -> str:
    from app.services.indicator_catalog import indicators_for

    names = {indicator.code: indicator.name for indicator in indicators_for(current_uf().source)}
    return names.get(code, INDICATOR_BY_CODE[code].name)


def governor_terms() -> list[GovernorTerm]:
    return GOVERNOR_TERMS_BY_UF.get(current_uf().code, [])


def mayor_terms() -> dict[str, list[GovernorTerm]]:
    return MAYOR_TERMS_BY_UF.get(current_uf().code, {})


def score_indicators() -> list[str]:
    """Indicadores do ranking: os do Rio, trocando roubo de rua pelo equivalente da fonte, se houver."""

    from app.services.indicator_catalog import indicators_for

    available = {indicator.code for indicator in indicators_for(current_uf().source)}
    output = [code if code != "roubo_rua" or "roubo_rua" in available else "roubo_outros" for code in SCORE_INDICATORS]
    return [code for code in output if code in available]


def governor_performance() -> GovernorPerformanceOut:
    latest_year, latest_month = repository().latest_period()
    latest_date = pd.Timestamp(latest_year, latest_month, 1) + pd.offsets.MonthEnd(0)
    rows = [_term_performance(term, latest_date.date()) for term in governor_terms()]

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
            f"Ranking calculado com dados mensais estaduais {SOURCE_PHRASE.get(current_uf().source, 'do Sinesp VDE')}. Para cada governador, compara a média mensal "
            "dos indicadores durante o período de governo com a média mensal dos 12 meses anteriores à posse. "
            "Percentual positivo significa redução média; mandatos curtos entram proporcionalmente pelo número de meses disponíveis."
        ),
        indicators=[_indicator_name(indicator) for indicator in score_indicators()],
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

    for indicator in score_indicators():
        frame = repository().rows(indicator, "state", current_uf().state_name)
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
        return _empty_row(term, term_end, "Sem linha de base suficiente nos dados oficiais.")

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
        best_indicator=_indicator_name(best_indicator),
        worst_indicator=_indicator_name(worst_indicator),
        best_indicator_change=round(-best_value, 1),
        worst_indicator_change=round(-worst_value, 1),
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
