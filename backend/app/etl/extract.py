from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from pathlib import Path

import httpx

from app.config import settings
from app.etl.sources import IspSource, default_isp_sources

logger = logging.getLogger(__name__)


def checksum_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_isp_sources(sources: list[IspSource] | None = None) -> list[dict]:
    raw_dir = (settings.data_dir / "raw" / "isp").resolve()
    raw_dir.mkdir(parents=True, exist_ok=True)
    metadata_path = raw_dir / "source_imports.jsonl"
    results: list[dict] = []

    for source in sources or default_isp_sources():
        destination = raw_dir / source.file_name
        metadata = {
            "source_name": source.name,
            "source_url": source.url,
            "file_name": source.file_name,
            "downloaded_at": datetime.now(UTC).isoformat(),
            "status": "pending",
            "checksum": None,
        }
        try:
            if destination.exists():
                metadata["status"] = "cached"
                metadata["checksum"] = checksum_file(destination)
                logger.info("Using cached ISP source %s", destination)
            else:
                logger.info("Downloading ISP source %s", source.url)
                with httpx.stream("GET", source.url, timeout=60, follow_redirects=True) as response:
                    response.raise_for_status()
                    with destination.open("wb") as file:
                        for chunk in response.iter_bytes():
                            file.write(chunk)
                metadata["status"] = "downloaded"
                metadata["checksum"] = checksum_file(destination)
            results.append(metadata)
        except Exception as exc:
            metadata["status"] = "error"
            metadata["error_message"] = str(exc)
            logger.exception("Failed to download ISP source %s", source.url)
            results.append(metadata)
        finally:
            with metadata_path.open("a", encoding="utf-8") as metadata_file:
                metadata_file.write(json.dumps(metadata, ensure_ascii=False) + "\n")

    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    download_isp_sources()

