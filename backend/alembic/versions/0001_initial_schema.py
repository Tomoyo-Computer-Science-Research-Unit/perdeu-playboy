"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-09
"""

from collections.abc import Sequence

import geoalchemy2
import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "source_imports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_name", sa.String(length=120), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("checksum", sa.String(length=128), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="downloaded"),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index("ix_source_imports_checksum", "source_imports", ["checksum"])

    op.create_table(
        "territories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("territory_type", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("ibge_code", sa.String(length=20), nullable=True),
        sa.Column("police_area_code", sa.String(length=40), nullable=True),
        sa.Column("geometry", geoalchemy2.Geometry("MULTIPOLYGON", srid=4326), nullable=True),
        sa.UniqueConstraint("territory_type", "normalized_name", name="uq_territory_type_name"),
    )

    op.create_table(
        "indicators",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=120), nullable=False, unique=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("unit", sa.String(length=40), nullable=False, server_default="ocorrencias"),
        sa.Column("source_name", sa.String(length=120), nullable=False),
    )

    op.create_table(
        "crime_stats_monthly",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_name", sa.String(length=120), nullable=False),
        sa.Column("territory_id", sa.Integer(), sa.ForeignKey("territories.id"), nullable=False),
        sa.Column("indicator_id", sa.Integer(), sa.ForeignKey("indicators.id"), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("period_date", sa.Date(), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("population", sa.Integer(), nullable=True),
        sa.Column("rate_per_100k", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint(
            "source_name",
            "territory_id",
            "indicator_id",
            "year",
            "month",
            name="uq_crime_stat_monthly",
        ),
    )

    op.create_table(
        "shooting_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_event_id", sa.String(length=120), nullable=False, unique=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(length=80), nullable=False),
        sa.Column("municipality", sa.String(length=120), nullable=True),
        sa.Column("neighborhood", sa.String(length=120), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("deaths", sa.Integer(), nullable=True),
        sa.Column("injured", sa.Integer(), nullable=True),
        sa.Column("police_operation", sa.Boolean(), nullable=True),
        sa.Column("stray_bullet", sa.Boolean(), nullable=True),
        sa.Column("children_victims", sa.Integer(), nullable=True),
        sa.Column("women_victims", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("verified_status", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("shooting_events")
    op.drop_table("crime_stats_monthly")
    op.drop_table("indicators")
    op.drop_table("territories")
    op.drop_index("ix_source_imports_checksum", table_name="source_imports")
    op.drop_table("source_imports")

