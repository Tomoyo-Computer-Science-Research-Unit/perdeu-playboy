import pandas as pd

from app.etl.sinesp import SinespStateConfig, _add_letalidade_violenta, _rows_from_frame


def test_sinesp_rows_normalize_pr_municipal_and_state_records() -> None:
    frame = pd.DataFrame(
        [
            {
                "uf": "PR",
                "municipio": "CURITIBA",
                "evento": "Homicídio doloso",
                "data_referencia": "1/1/2026",
                "total_vitima": "10",
                "total": None,
                "abrangencia": "Estadual",
            },
            {
                "uf": "PR",
                "municipio": "NÃO INFORMADO",
                "evento": "Roubo de veículo",
                "data_referencia": "1/1/2026",
                "total_vitima": None,
                "total": "22",
                "abrangencia": "Estadual",
            },
        ]
    )

    rows = _rows_from_frame(
        frame,
        SinespStateConfig(uf="PR", state_name="Estado do Paraná"),
        {"curitiba": "Curitiba"},
        2026,
        2,
    )

    assert {
        "source_name": "Sinesp VDE/MJSP",
        "territory_type": "municipality",
        "territory_name": "Curitiba",
        "year": 2026,
        "month": 1,
        "indicator": "homicidio_doloso",
        "value": 10.0,
    } in rows
    assert {
        "source_name": "Sinesp VDE/MJSP",
        "territory_type": "state",
        "territory_name": "Estado do Paraná",
        "year": 2026,
        "month": 1,
        "indicator": "roubo_veiculo",
        "value": 22.0,
    } in rows


def test_sinesp_adds_violent_lethality() -> None:
    frame = pd.DataFrame(
        [
            {
                "source_name": "Sinesp VDE/MJSP",
                "territory_type": "state",
                "territory_name": "Estado do Paraná",
                "year": 2026,
                "month": 1,
                "indicator": "homicidio_doloso",
                "value": 10.0,
            },
            {
                "source_name": "Sinesp VDE/MJSP",
                "territory_type": "state",
                "territory_name": "Estado do Paraná",
                "year": 2026,
                "month": 1,
                "indicator": "latrocinio",
                "value": 2.0,
            },
        ]
    )

    result = _add_letalidade_violenta(frame)
    lethal = result[result["indicator"] == "letalidade_violenta"].iloc[0]

    assert lethal["value"] == 12.0
