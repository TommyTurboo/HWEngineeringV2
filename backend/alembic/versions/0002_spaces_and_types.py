"""spaces, cabinet types, etim fields

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-21

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "spaces",
        sa.Column("id", UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", UUID(as_uuid=True), nullable=False),
        sa.Column("parent_id", UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("designation", sa.String(), nullable=True),
        sa.Column("level_type", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["spaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.add_column("cabinets", sa.Column("cabinet_type", sa.String(), nullable=True))
    op.add_column("cabinets", sa.Column("space_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_cabinets_space_id", "cabinets", "spaces", ["space_id"], ["id"], ondelete="SET NULL"
    )

    op.add_column("field_components", sa.Column("space_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_field_components_space_id", "field_components", "spaces", ["space_id"], ["id"], ondelete="SET NULL"
    )

    op.add_column("component_typicals", sa.Column("etim_class_id", sa.String(), nullable=True))
    op.add_column("component_typicals", sa.Column("etim_class_desc", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("component_typicals", "etim_class_desc")
    op.drop_column("component_typicals", "etim_class_id")
    op.drop_constraint("fk_field_components_space_id", "field_components", type_="foreignkey")
    op.drop_column("field_components", "space_id")
    op.drop_constraint("fk_cabinets_space_id", "cabinets", type_="foreignkey")
    op.drop_column("cabinets", "space_id")
    op.drop_column("cabinets", "cabinet_type")
    op.drop_table("spaces")
