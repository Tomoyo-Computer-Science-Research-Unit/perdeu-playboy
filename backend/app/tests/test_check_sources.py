from datetime import date
from pathlib import Path

from app.etl.check_sources import Contract, check_file

CONTRACT = Contract(columns=("ano", "mes", "hom_doloso"), key=("ano", "mes"), min_rows=2, first_year=2020, counts=("hom_doloso",))
TODAY = date(2026, 10, 13)


def write(tmp_path: Path, rows: list[str]) -> Path:
    path = tmp_path / "x.csv"
    path.write_text("ano;mes;hom_doloso\n" + "\n".join(rows) + "\n", encoding="utf-8")
    return path


def test_valid_file_passes(tmp_path: Path) -> None:
    report = check_file(write(tmp_path, ["2026;7;10", "2026;8;12"]), CONTRACT, TODAY)
    assert report.ok
    assert report.rows == 2
    assert report.latest_month == "2026-08"
    assert report.lag_months == 2
    assert report.warnings == []


def test_missing_column_fails(tmp_path: Path) -> None:
    path = tmp_path / "x.csv"
    path.write_text("ano;mes\n2026;8\n", encoding="utf-8")
    report = check_file(path, CONTRACT, TODAY)
    assert not report.ok
    assert "colunas ausentes: hom_doloso" in report.problems


def test_duplicate_keys_negative_values_and_future_month_fail(tmp_path: Path) -> None:
    report = check_file(write(tmp_path, ["2026;8;10", "2026;8;11", "2026;12;-1"]), CONTRACT, TODAY)
    assert not report.ok
    assert any("chaves repetidas" in problem for problem in report.problems)
    assert any("negativos" in problem for problem in report.problems)
    assert any("futuro" in problem for problem in report.problems)


def test_old_data_is_a_warning_not_a_failure(tmp_path: Path) -> None:
    report = check_file(write(tmp_path, ["2026;1;10", "2026;2;12"]), CONTRACT, TODAY)
    assert report.ok
    assert report.lag_months == 8
    assert any("ha 8 meses" in warning for warning in report.warnings)


def test_missing_file_fails(tmp_path: Path) -> None:
    report = check_file(tmp_path / "nope.csv", CONTRACT, TODAY)
    assert report.problems == ["arquivo ausente ou vazio"]
