from __future__ import annotations

import logging
import unicodedata

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import CrimeStatMonthly, Indicator, SourceImport, Territory
from app.schemas import NormalizedCrimeStat, SourceImportIn
from app.services.indicator_catalog import INDICATOR_BY_CODE

logger = logging.getLogger(__name__)


def load_stats(session: Session, rows: list[NormalizedCrimeStat]) -> int:
    loaded = 0
    territory_cache: dict[tuple[str, str], Territory] = {}
    indicator_cache: dict[str, Indicator] = {}

    for row in rows:
        territory = _get_or_create_territory(session, territory_cache, row.territory_type, row.territory_name)
        indicator = _get_or_create_indicator(session, indicator_cache, row.indicator)
        statement = insert(CrimeStatMonthly).values(
            source_name=row.source_name,
            territory_id=territory.id,
            indicator_id=indicator.id,
            year=row.year,
            month=row.month,
            period_date=row.period_date,
            value=row.value,
        )
        statement = statement.on_conflict_do_update(
            constraint="uq_crime_stat_monthly",
            set_={
                "value": statement.excluded.value,
                "period_date": statement.excluded.period_date,
            },
        )
        session.execute(statement)
        loaded += 1

    session.commit()
    logger.info("Loaded %s monthly crime stat rows", loaded)
    return loaded


def load_source_import(session: Session, source_import: SourceImportIn) -> SourceImport:
    record = SourceImport(**source_import.model_dump())
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def _get_or_create_territory(
    session: Session,
    cache: dict[tuple[str, str], Territory],
    territory_type: str,
    territory_name: str,
) -> Territory:
    normalized_name = _normalize_key(territory_name)
    key = (territory_type, normalized_name)
    if key in cache:
        return cache[key]
    territory = session.scalar(
        select(Territory).where(
            Territory.territory_type == territory_type,
            Territory.normalized_name == normalized_name,
        )
    )
    if territory is None:
        territory = Territory(
            territory_type=territory_type,
            name=territory_name,
            normalized_name=normalized_name,
        )
        session.add(territory)
        session.flush()
    cache[key] = territory
    return territory


def _get_or_create_indicator(
    session: Session,
    cache: dict[str, Indicator],
    indicator_code: str,
) -> Indicator:
    if indicator_code in cache:
        return cache[indicator_code]
    indicator = session.scalar(select(Indicator).where(Indicator.code == indicator_code))
    if indicator is None:
        catalog = INDICATOR_BY_CODE[indicator_code]
        indicator = Indicator(**catalog.model_dump())
        session.add(indicator)
        session.flush()
    cache[indicator_code] = indicator
    return indicator


def _normalize_key(value: str) -> str:
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return " ".join(text.lower().split())

