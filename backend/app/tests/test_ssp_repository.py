from datetime import date

from app.services import ssp_repository as ssp
from app.services.governor_performance import governor_terms, mayor_terms, score_indicators
from app.services.indicator_catalog import indicators_for
from app.uf import current, published_ufs, set_current


def _item(label: str, values: list[int], published: int = 12) -> dict[str, object]:
    item: dict[str, object] = {"delito": {"delito": label}, "publicado": published}
    for column, value in zip(ssp.MONTHS, values):
        item[column] = value
    return item


def _payload(*items: dict[str, object]) -> dict[str, object]:
    return {"success": True, "data": [{"ano": 2024, "listaDados": list(items)}]}


def test_robbery_other_is_total_minus_cargo_and_bank() -> None:
    payload = _payload(
        _item("TOTAL DE ROUBO - OUTROS (1)", [100] * 12),
        _item("ROUBO DE CARGA", [7] * 12),
        _item("ROUBO A BANCO", [1] * 12),
    )
    records = ssp._records_from_payload(payload, "state", 0, ssp.STATE_NAME, 2024, "ssp6")
    other = [row for row in records if row["indicator"] == "roubo_outros"]
    cargo = [row for row in records if row["indicator"] == "roubo_carga"]
    assert len(other) == 12 and all(row["value"] == 92 for row in other)
    assert len(cargo) == 12 and cargo[0]["value"] == 7


def test_unpublished_months_are_missing_not_zero() -> None:
    payload = _payload(_item("Nº DE VÍTIMAS EM HOMICÍDIO DOLOSO (3)", [10] * 8 + [0] * 4, published=8))
    records = ssp._records_from_payload(payload, "state", 0, ssp.STATE_NAME, 2026, "ssp6")
    assert [row["month"] for row in records] == list(range(1, 9))
    assert all(row["indicator"] == "homicidio_doloso" for row in records)


def test_bodily_harm_death_starts_in_september_2016() -> None:
    label = "LESÃO CORPORAL SEGUIDA DE MORTE"
    before = ssp._records_from_payload(_payload(_item(label, [0] * 12)), "state", 0, ssp.STATE_NAME, 2009, "ssp6")
    during = ssp._records_from_payload(_payload(_item(label, [0] * 8 + [2, 3, 3, 4])), "state", 0, ssp.STATE_NAME, 2016, "ssp6")
    assert before == []
    assert [row["month"] for row in during] == [9, 10, 11, 12]


def test_district_name_and_refresh_years() -> None:
    assert ssp.district_name("078 DP - Jardins") == "78º DP Jardins"
    assert ssp.refresh_years(date(2026, 10, 14)) == {2026}
    assert ssp.refresh_years(date(2026, 2, 1)) == {2025, 2026}


def test_uf_configuration_drives_catalog_and_terms() -> None:
    assert [uf.code for uf in published_ufs()][:2] == ["RJ", "SP"]
    try:
        set_current("SP")
        assert current().source == "ssp"
        codes = [indicator.code for indicator in indicators_for("ssp")]
        assert "roubo_outros" in codes and "roubo_rua" not in codes
        assert "roubo_outros" in score_indicators()
        assert governor_terms()[-1].governor == "Tarcísio de Freitas"
        assert mayor_terms()["São Paulo"][-1].governor == "Ricardo Nunes"
        set_current("MG")
        assert current().source == "sinesp"
        assert "roubo_rua" not in score_indicators() and "roubo_outros" not in score_indicators()
    finally:
        set_current("RJ")
