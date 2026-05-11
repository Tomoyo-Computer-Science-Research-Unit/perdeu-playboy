from __future__ import annotations

import logging
from pathlib import Path

from app.config import settings
from app.database import SessionLocal
from app.etl.extract import download_isp_sources
from app.etl.load import load_stats
from app.etl.sources import default_isp_sources
from app.etl.transform import transform_isp_file

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


def run_pipeline() -> None:
    sources = default_isp_sources()
    results = download_isp_sources(sources)
    with SessionLocal() as session:
        for source, result in zip(sources, results, strict=False):
            if result["status"] == "error":
                logger.warning("Skipping failed source %s", source.name)
                continue
            path = Path(result["file_name"])
            raw_path = (settings.data_dir / "raw" / "isp").resolve() / path
            rows = transform_isp_file(raw_path, territory_type=source.territory_type, source_name=source.name)
            load_stats(session, rows)


if __name__ == "__main__":
    run_pipeline()
