"""Initial Family Gift Fund schema.

Revision ID: 20260611_0001
Revises:
Create Date: 2026-06-11
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260611_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "families",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_families_id"), "families", ["id"], unique=False)
    op.create_index(op.f("ix_families_name"), "families", ["name"], unique=False)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("family_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)
    op.create_index(op.f("ix_users_family_id"), "users", ["family_id"], unique=False)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "gifts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("target_amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("family_id", sa.Integer(), nullable=False),
        sa.Column("recipient_user_id", sa.Integer(), nullable=False),
        sa.Column("creator_user_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["creator_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"]),
        sa.ForeignKeyConstraint(["recipient_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_gifts_creator_user_id"), "gifts", ["creator_user_id"], unique=False)
    op.create_index(op.f("ix_gifts_family_id"), "gifts", ["family_id"], unique=False)
    op.create_index(op.f("ix_gifts_id"), "gifts", ["id"], unique=False)
    op.create_index(op.f("ix_gifts_recipient_user_id"), "gifts", ["recipient_user_id"], unique=False)
    op.create_index(op.f("ix_gifts_title"), "gifts", ["title"], unique=False)

    op.create_table(
        "contributions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("gift_id", sa.Integer(), nullable=False),
        sa.Column("allocated_amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("is_paid", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["gift_id"], ["gifts.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_contributions_gift_id"), "contributions", ["gift_id"], unique=False)
    op.create_index(op.f("ix_contributions_id"), "contributions", ["id"], unique=False)
    op.create_index(op.f("ix_contributions_user_id"), "contributions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_contributions_user_id"), table_name="contributions")
    op.drop_index(op.f("ix_contributions_id"), table_name="contributions")
    op.drop_index(op.f("ix_contributions_gift_id"), table_name="contributions")
    op.drop_table("contributions")

    op.drop_index(op.f("ix_gifts_title"), table_name="gifts")
    op.drop_index(op.f("ix_gifts_recipient_user_id"), table_name="gifts")
    op.drop_index(op.f("ix_gifts_id"), table_name="gifts")
    op.drop_index(op.f("ix_gifts_family_id"), table_name="gifts")
    op.drop_index(op.f("ix_gifts_creator_user_id"), table_name="gifts")
    op.drop_table("gifts")

    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_family_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    op.drop_index(op.f("ix_families_name"), table_name="families")
    op.drop_index(op.f("ix_families_id"), table_name="families")
    op.drop_table("families")
