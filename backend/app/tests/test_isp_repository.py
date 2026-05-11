from app.services import isp_repository


def test_police_area_uses_monthly_cisp_source_not_weapons_source() -> None:
    assert isp_repository.SOURCE_BY_TERRITORY["police_area"].file_name == "BaseDPEvolucaoMensalCisp.csv"
