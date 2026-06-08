from app.services import isp_repository


def test_police_area_uses_monthly_cisp_source_not_weapons_source() -> None:
    assert isp_repository.SOURCE_BY_TERRITORY["police_area"].file_name == "BaseDPEvolucaoMensalCisp.csv"


def test_weapons_are_available_for_municipal_map() -> None:
    frame = isp_repository.rows(
        "apreensao_armas",
        "municipality",
        start_year=2014,
        end_year=2014,
    )

    assert not frame.empty
    assert frame["value"].sum() > 0
    assert frame["territory_name"].nunique() > 1
