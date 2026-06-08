from __future__ import annotations

import logging
from pathlib import Path

from app.config import settings
from app.database import SessionLocal
from app.etl.extract import download_isp_sources
from app.etl.load import load_silver_batch
from app.etl.medallion import GoldLoadResult, MedallionPaths
from app.etl.sources import default_isp_sources
from app.etl.transform import transform_to_silver

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


def medallion_paths() -> MedallionPaths:
    """Return the configured medallion filesystem layout."""

    paths = MedallionPaths(
        bronze_dir=(settings.data_dir / "raw").resolve(),
        silver_dir=(settings.data_dir / "processed" / "silver").resolve(),
        gold_dir=(settings.data_dir / "processed" / "gold").resolve(),
    )
    paths.ensure()
    return paths


def run_pipeline() -> list[GoldLoadResult]:
    """Run the official ISP ETL through bronze, silver, and gold layers.

    Returns:
        Gold load results for each configured source.
    """

    medallion_paths()
    sources = default_isp_sources()
    bronze_results = download_isp_sources(sources)
    gold_results: list[GoldLoadResult] = []
    with SessionLocal() as session:
        for source, result in zip(sources, bronze_results, strict=False):
            if result.status == "error":
                logger.warning("Skipping failed source %s", source.name)
                gold_results.append(
                    GoldLoadResult(
                        source_name=source.name,
                        status="skipped",
                        error_message=result.error_message,
                    )
                )
                continue
            path = Path(result.file_name)
            raw_path = (settings.data_dir / "raw" / "isp").resolve() / path
            silver = transform_to_silver(
                raw_path,
                territory_type=source.territory_type,
                source_name=source.name,
            )
            gold_results.append(load_silver_batch(session, silver))
    return gold_results


if __name__ == "__main__":
    run_pipeline()
