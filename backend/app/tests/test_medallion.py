from pathlib import Path

import pytest
from pydantic import ValidationError

from app.etl.medallion import MedallionPaths
from app.etl.sources import IspSource
from app.etl.transform import transform_to_silver


def test_medallion_paths_create_expected_directories(tmp_path: Path) -> None:
    """Medallion path validation should create all configured zones."""

    paths = MedallionPaths(
        bronze_dir=tmp_path / "bronze",
        silver_dir=tmp_path / "silver",
        gold_dir=tmp_path / "gold",
    )

    paths.ensure()

    assert paths.bronze_dir.is_dir()
    assert paths.silver_dir.is_dir()
    assert paths.gold_dir.is_dir()


def test_isp_source_rejects_non_http_url() -> None:
    """Source descriptors should reject non-HTTP inputs before extraction."""

    with pytest.raises(ValidationError):
        IspSource(
            name="bad_source",
            url="file:///tmp/source.csv",
            territory_type="state",
            file_name="source.csv",
        )


def test_transform_to_silver_returns_error_batch_for_invalid_csv(tmp_path: Path) -> None:
    """Silver transformation should return an error batch instead of crashing."""

    path = tmp_path / "invalid.csv"
    path.write_text("not_a_year;not_a_month\n1;2\n", encoding="utf-8")

    batch = transform_to_silver(path, territory_type="state", source_name="test_source")

    assert batch.status == "error"
    assert batch.rows == []
    assert batch.error_message is not None
