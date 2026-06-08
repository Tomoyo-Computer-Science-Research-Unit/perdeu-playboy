import pandas as pd

from app.etl.transform import normalize_column_name, transform_isp_dataframe


def test_normalize_column_name_removes_accents_and_symbols() -> None:
    assert normalize_column_name("Morte por intervenção policial") == "morte_por_intervencao_policial"


def test_transform_isp_dataframe_melts_indicator_columns_and_yoy() -> None:
    frame = pd.DataFrame(
        [
            {"ano": 2024, "mes": 1, "municipio": "Rio de Janeiro", "hom_doloso": 10, "roubo_rua": "100"},
            {"ano": 2025, "mes": 1, "municipio": "Rio de Janeiro", "hom_doloso": 12, "roubo_rua": "110"},
        ]
    )

    rows = transform_isp_dataframe(frame, territory_type="municipality")
    homicide_rows = [row for row in rows if row.indicator == "homicidio_doloso"]

    assert len(rows) == 4
    assert homicide_rows[0].territory_name == "Rio de Janeiro"
    assert homicide_rows[1].previous_year_same_period == 10
    assert homicide_rows[1].yoy_absolute_change == 2
