from dataclasses import dataclass
from decimal import Decimal

import pytest

from app import models
from app.services import (
    AllocationValidationError,
    split_amount_equally,
    validate_contribution_allocations,
)


@dataclass(frozen=True)
class AllocationInput:
    user_id: int
    allocated_amount: Decimal


def add_user(
    db_session,
    user_id: int,
    family_id: int,
    email: str,
    name: str = "Test User",
) -> models.User:
    user = models.User(
        id=user_id,
        name=name,
        email=email,
        hashed_password="test-password-hash",
        family_id=family_id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_split_amount_equally_distributes_remainder_cents() -> None:
    split_amounts = split_amount_equally(Decimal("10.00"), 3)

    assert split_amounts == [Decimal("3.34"), Decimal("3.33"), Decimal("3.33")]
    assert sum(split_amounts, Decimal("0.00")) == Decimal("10.00")


def test_split_amount_equally_returns_empty_list_for_zero_contributors() -> None:
    assert split_amount_equally(Decimal("10.00"), 0) == []


def test_validate_contribution_allocations_splits_between_default_contributors(
    db_session,
    test_family: models.Family,
    authenticated_user: models.User,
) -> None:
    first_contributor = add_user(db_session, 2002, test_family.id, "first@example.com")
    second_contributor = add_user(db_session, 2003, test_family.id, "second@example.com")

    allocations = validate_contribution_allocations(
        db=db_session,
        family_id=test_family.id,
        recipient_user_id=authenticated_user.id,
        target_amount=Decimal("10.00"),
        custom_allocations=None,
    )

    assert allocations == [
        (first_contributor, Decimal("5")),
        (second_contributor, Decimal("5")),
    ]


def test_validate_contribution_allocations_rejects_duplicate_participants(
    db_session,
    test_family: models.Family,
    authenticated_user: models.User,
) -> None:
    contributor = add_user(db_session, 2002, test_family.id, "duplicate@example.com")

    with pytest.raises(AllocationValidationError, match="Participant list cannot contain duplicates"):
        validate_contribution_allocations(
            db=db_session,
            family_id=test_family.id,
            recipient_user_id=authenticated_user.id,
            target_amount=Decimal("10.00"),
            custom_allocations=[
                AllocationInput(contributor.id, Decimal("5.00")),
                AllocationInput(contributor.id, Decimal("5.00")),
            ],
        )


def test_validate_contribution_allocations_rejects_missing_users(
    db_session,
    test_family: models.Family,
    authenticated_user: models.User,
) -> None:
    with pytest.raises(AllocationValidationError, match="All participants must belong to the gift family"):
        validate_contribution_allocations(
            db=db_session,
            family_id=test_family.id,
            recipient_user_id=authenticated_user.id,
            target_amount=Decimal("10.00"),
            custom_allocations=[
                AllocationInput(9999, Decimal("10.00")),
            ],
        )


def test_validate_contribution_allocations_rejects_total_amount_mismatch(
    db_session,
    test_family: models.Family,
    authenticated_user: models.User,
) -> None:
    contributor = add_user(db_session, 2002, test_family.id, "mismatch@example.com")

    with pytest.raises(AllocationValidationError, match="Contribution allocations must exactly equal the target amount"):
        validate_contribution_allocations(
            db=db_session,
            family_id=test_family.id,
            recipient_user_id=authenticated_user.id,
            target_amount=Decimal("10.00"),
            custom_allocations=[
                AllocationInput(contributor.id, Decimal("9.99")),
            ],
        )


def test_validate_contribution_allocations_rejects_recipient_contribution(
    db_session,
    test_family: models.Family,
    authenticated_user: models.User,
) -> None:
    with pytest.raises(AllocationValidationError, match="Gift recipient cannot contribute to their own gift"):
        validate_contribution_allocations(
            db=db_session,
            family_id=test_family.id,
            recipient_user_id=authenticated_user.id,
            target_amount=Decimal("10.00"),
            custom_allocations=[
                AllocationInput(authenticated_user.id, Decimal("10.00")),
            ],
        )
