from app.services.territory_repository import _split_neighborhoods, territorial_units


def test_split_neighborhoods_handles_commas_and_final_e() -> None:
    assert _split_neighborhoods("Catete, Cosme Velho, Flamengo, Glória e Laranjeiras") == [
        "Catete",
        "Cosme Velho",
        "Flamengo",
        "Glória",
        "Laranjeiras",
    ]


def test_territorial_units_keep_full_isp_unit_name() -> None:
    units = territorial_units("Rio de Janeiro")
    catete = next(unit for unit in units if unit["police_area_name"] == "CISP 009")

    assert catete["territorial_unit"] == "Catete, Cosme Velho, Flamengo, Glória e Laranjeiras"
    assert catete["name"] == "CISP 009 - Catete, Cosme Velho, Flamengo, Glória e Laranjeiras"
