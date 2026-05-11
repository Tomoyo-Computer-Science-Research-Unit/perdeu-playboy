from app.services.population_repository import _parse_sidra_rows


def test_parse_sidra_rows_extracts_ibge_code_name_and_population() -> None:
    rows = [
        {
            "D1C": "3304557",
            "D1N": "Rio de Janeiro - RJ",
            "V": "6729894",
            "D3C": "2025",
        }
    ]

    parsed = _parse_sidra_rows(rows)

    assert parsed == [
        {
            "ibge_code": "3304557",
            "municipality_name": "Rio de Janeiro",
            "normalized_name": "rio de janeiro",
            "population": 6729894.0,
            "year": 2025,
            "source_name": "IBGE SIDRA - Populacao residente estimada",
        }
    ]
