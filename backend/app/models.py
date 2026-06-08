from datetime import date, datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class SourceImport(Base):
    __tablename__ = "source_imports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_name: Mapped[str] = mapped_column(String(120), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    checksum: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(40), default="downloaded")
    row_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class Territory(Base):
    __tablename__ = "territories"
    __table_args__ = (UniqueConstraint("territory_type", "normalized_name", name="uq_territory_type_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    territory_type: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ibge_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    police_area_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    geometry = mapped_column(Geometry("MULTIPOLYGON", srid=4326), nullable=True)

    stats: Mapped[list["CrimeStatMonthly"]] = relationship(back_populates="territory")


class Indicator(Base):
    __tablename__ = "indicators"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    unit: Mapped[str] = mapped_column(String(40), default="ocorrencias")
    source_name: Mapped[str] = mapped_column(String(120), nullable=False)

    stats: Mapped[list["CrimeStatMonthly"]] = relationship(back_populates="indicator")


class CrimeStatMonthly(Base):
    __tablename__ = "crime_stats_monthly"
    __table_args__ = (
        UniqueConstraint(
            "source_name",
            "territory_id",
            "indicator_id",
            "year",
            "month",
            name="uq_crime_stat_monthly",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_name: Mapped[str] = mapped_column(String(120), nullable=False)
    territory_id: Mapped[int] = mapped_column(ForeignKey("territories.id"), nullable=False)
    indicator_id: Mapped[int] = mapped_column(ForeignKey("indicators.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    period_date: Mapped[date] = mapped_column(Date, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    population: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rate_per_100k: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    territory: Mapped[Territory] = relationship(back_populates="stats")
    indicator: Mapped[Indicator] = relationship(back_populates="stats")


class ShootingEvent(Base):
    __tablename__ = "shooting_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_event_id: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    state: Mapped[str] = mapped_column(String(80), nullable=False)
    municipality: Mapped[str | None] = mapped_column(String(120), nullable=True)
    neighborhood: Mapped[str | None] = mapped_column(String(120), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    deaths: Mapped[int | None] = mapped_column(Integer, nullable=True)
    injured: Mapped[int | None] = mapped_column(Integer, nullable=True)
    police_operation: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    stray_bullet: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    children_victims: Mapped[int | None] = mapped_column(Integer, nullable=True)
    women_victims: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    verified_status: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
