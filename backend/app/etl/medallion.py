from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas import NormalizedCrimeStat

MedallionLayer = Literal["bronze", "silver", "gold"]
PipelineStatus = Literal["pending", "cached", "downloaded", "transformed", "loaded", "error", "skipped"]


class BronzeImport(BaseModel):
    """Raw source file metadata produced by the bronze layer.

    Attributes:
        source_name: Stable source identifier.
        source_url: Original URL used to obtain the file.
        file_name: Local file name in the raw landing zone.
        downloaded_at: Timestamp when the import was attempted.
        status: Download status.
        checksum: SHA-256 checksum when a local file is available.
        error_message: Human-readable error details for failed imports.
    """

    source_name: str
    source_url: str
    file_name: str
    downloaded_at: datetime
    status: PipelineStatus = "pending"
    checksum: str | None = None
    error_message: str | None = None


class SilverBatch(BaseModel):
    """Validated long-format crime-stat records produced by the silver layer.

    Attributes:
        source_name: Stable source identifier.
        file_name: Raw file used as input.
        territory_type: Territory level represented by the batch.
        rows: Validated normalized records.
        status: Transformation status.
        error_message: Human-readable error details for failed transforms.
    """

    source_name: str
    file_name: str
    territory_type: str
    rows: list[NormalizedCrimeStat] = Field(default_factory=list)
    status: PipelineStatus = "transformed"
    error_message: str | None = None


class GoldLoadResult(BaseModel):
    """Database load result produced by the gold layer.

    Attributes:
        source_name: Stable source identifier.
        row_count: Number of rows loaded or skipped.
        status: Load status.
        error_message: Human-readable error details for failed loads.
    """

    source_name: str
    row_count: int = 0
    status: PipelineStatus = "loaded"
    error_message: str | None = None


class MedallionPaths(BaseModel):
    """Filesystem layout for the ETL medallion zones.

    Attributes:
        bronze_dir: Directory for raw source files.
        silver_dir: Directory for normalized intermediate data.
        gold_dir: Directory for database-ready or published artifacts.
    """

    bronze_dir: Path
    silver_dir: Path
    gold_dir: Path

    def ensure(self) -> None:
        """Create medallion directories when they are missing."""

        for directory in (self.bronze_dir, self.silver_dir, self.gold_dir):
            directory.mkdir(parents=True, exist_ok=True)
