from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Family(Base):
    __tablename__ = "families"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    users: Mapped[list["User"]] = relationship(back_populates="family", cascade="all, delete-orphan")
    gifts: Mapped[list["Gift"]] = relationship(back_populates="family", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), nullable=False, index=True)

    family: Mapped["Family"] = relationship(back_populates="users")
    received_gifts: Mapped[list["Gift"]] = relationship(
        back_populates="recipient",
        foreign_keys="Gift.recipient_user_id",
    )
    contributions: Mapped[list["Contribution"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Gift(Base):
    __tablename__ = "gifts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"), nullable=False, index=True)
    recipient_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    creator_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    family: Mapped["Family"] = relationship(back_populates="gifts")
    recipient: Mapped["User"] = relationship(back_populates="received_gifts", foreign_keys=[recipient_user_id])
    creator: Mapped["User"] = relationship(foreign_keys=[creator_user_id])
    contributions: Mapped[list["Contribution"]] = relationship(
        back_populates="gift",
        cascade="all, delete-orphan",
    )


class Contribution(Base):
    __tablename__ = "contributions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    gift_id: Mapped[int] = mapped_column(ForeignKey("gifts.id"), nullable=False, index=True)
    allocated_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user: Mapped["User"] = relationship(back_populates="contributions")
    gift: Mapped["Gift"] = relationship(back_populates="contributions")
