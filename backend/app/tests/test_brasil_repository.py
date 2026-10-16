from datetime import timedelta

import pandas as pd
import pytest

from app.services import brasil_repository
from app.services.governor_performance import GOVERNOR_TERMS_BY_UF, MAYOR_TERMS_BY_UF
from app.uf import country, current, published_levels, published_ufs, set_current


def test_brasil_is_listed_last_and_is_not_a_uf() -> None:
    assert country().code == "BR"
    assert "BR" not in [uf.code for uf in published_ufs()]
    assert [uf.code for uf in published_levels()][-1] == "BR"
    assert len(brasil_repository.uf_codes()) == 27


def test_presidents_are_continuous_since_the_start_of_the_series() -> None:
    terms = GOVERNOR_TERMS_BY_UF["BR"]
    assert terms[0].start.year <= country().start_year
    assert terms[-1].end is None
    for previous, following in zip(terms, terms[1:]):
        assert previous.end is not None and previous.end + timedelta(days=1) == following.start, previous.governor
    assert MAYOR_TERMS_BY_UF.get("BR", {}) == {}


def test_national_total_only_where_every_uf_has_data(monkeypatch: pytest.MonkeyPatch) -> None:
    rows = []
    for code in ("AA", "BB"):
        for month in (1, 2):
            rows.append({"indicator": "homicidio_doloso", "year": 2020, "month": month, "value": 10.0, "uf": code, "territory_name": code})
    # BB nao mandou fevereiro de roubo de carga; AA mandou zero em janeiro.
    rows.append({"indicator": "roubo_carga", "year": 2020, "month": 1, "value": 0.0, "uf": "AA", "territory_name": "AA"})
    rows.append({"indicator": "roubo_carga", "year": 2020, "month": 1, "value": 5.0, "uf": "BB", "territory_name": "BB"})
    rows.append({"indicator": "roubo_carga", "year": 2020, "month": 2, "value": 7.0, "uf": "AA", "territory_name": "AA"})
    frame = pd.DataFrame(rows)
    monkeypatch.setattr(brasil_repository, "_uf_frame", lambda: frame)
    monkeypatch.setattr(brasil_repository, "uf_codes", lambda: ["AA", "BB"])
    brasil_repository._country_frame.cache_clear()
    try:
        total = brasil_repository._country_frame()
        homicides = total[total["indicator"] == "homicidio_doloso"].set_index("month")["value"].to_dict()
        cargo = total[total["indicator"] == "roubo_carga"].set_index("month")["value"].to_dict()
        assert homicides == {1: 20.0, 2: 20.0}
        assert cargo == {1: 5.0}
    finally:
        brasil_repository._country_frame.cache_clear()


def test_brasil_rows_have_the_country_and_the_27_ufs() -> None:
    previous = current().code
    try:
        set_current("BR")
        assert brasil_repository.territories("state") == ["Brasil"]
        names = brasil_repository.territories("municipality")
        assert len(names) == 27 and "Rio de Janeiro" in names and "Distrito Federal" in names
        year, month = brasil_repository.latest_period()
        assert year >= 2026
        state = brasil_repository.rows("homicidio_doloso", "state")
        ufs = brasil_repository.rows("homicidio_doloso", "municipality", start_year=year, end_year=year)
        last_state = state[(state["year"] == year) & (state["month"] == month)]["value"].sum()
        last_ufs = ufs[ufs["month"] == month]["value"].sum()
        assert last_state == last_ufs
    finally:
        set_current(previous)
