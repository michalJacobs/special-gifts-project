from decimal import Decimal

import pytest
from fastapi import status

from app import models
from app.core.config import settings
from app.core.security import create_access_token
from app.routers import gifts as gifts_router


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


def add_family(db_session, family_id: int = 1002, name: str = "Other Family") -> models.Family:
    family = models.Family(id=family_id, name=name)
    db_session.add(family)
    db_session.commit()
    db_session.refresh(family)
    return family


def add_gift(
    db_session,
    family_id: int,
    recipient_user_id: int,
    creator_user_id: int,
    title: str = "Existing Gift",
    target_amount: Decimal = Decimal("10.00"),
) -> models.Gift:
    gift = models.Gift(
        title=title,
        target_amount=target_amount,
        family_id=family_id,
        recipient_user_id=recipient_user_id,
        creator_user_id=creator_user_id,
    )
    db_session.add(gift)
    db_session.commit()
    db_session.refresh(gift)
    return gift


def add_contribution(
    db_session,
    gift_id: int,
    user_id: int,
    allocated_amount: Decimal = Decimal("10.00"),
    is_paid: bool = False,
) -> models.Contribution:
    contribution = models.Contribution(
        gift_id=gift_id,
        user_id=user_id,
        allocated_amount=allocated_amount,
        is_paid=is_paid,
    )
    db_session.add(contribution)
    db_session.commit()
    db_session.refresh(contribution)
    return contribution


def auth_headers_for(user: models.User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(subject=user.id)}"}


def test_create_gift_persists_contributions_and_sends_payment_request_tasks(
    client,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
    auth_headers: dict[str, str],
    test_family: models.Family,
    authenticated_user: models.User,
) -> None:
    recipient = add_user(db_session, 2002, test_family.id, "recipient@example.com", "Recipient")
    contributor = add_user(db_session, 2003, test_family.id, "contributor@example.com", "Contributor")
    sent_payment_requests = []

    async def fake_send_payment_request_email(
        to_email: str,
        gift_title: str,
        allocated_amount: float,
        creator_name: str,
    ) -> None:
        sent_payment_requests.append((to_email, gift_title, allocated_amount, creator_name))

    monkeypatch.setattr(gifts_router, "send_payment_request_email", fake_send_payment_request_email)

    response = client.post(
        "/gifts",
        headers=auth_headers,
        json={
            "title": "Birthday Gift",
            "target_amount": "10.00",
            "family_id": test_family.id,
            "recipient_user_id": recipient.id,
            "custom_allocations": [
                {"user_id": contributor.id, "allocated_amount": "10.00"},
            ],
        },
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    assert body["title"] == "Birthday Gift"
    assert body["creator_user_id"] == authenticated_user.id
    assert len(body["contributions"]) == 1

    saved_gift = db_session.get(models.Gift, body["id"])
    assert saved_gift is not None
    assert saved_gift.family_id == test_family.id
    assert saved_gift.recipient_user_id == recipient.id
    assert saved_gift.creator_user_id == authenticated_user.id

    saved_contribution = db_session.get(models.Contribution, body["contributions"][0]["id"])
    assert saved_contribution is not None
    assert saved_contribution.user_id == contributor.id
    assert saved_contribution.allocated_amount == Decimal("10.00")
    assert saved_contribution.is_paid is False
    assert sent_payment_requests == [
        ("contributor@example.com", "Birthday Gift", 10.0, authenticated_user.name),
    ]


def test_create_gift_rejects_family_outside_current_users_family(
    client,
    db_session,
    auth_headers: dict[str, str],
) -> None:
    other_family = add_family(db_session)
    recipient = add_user(db_session, 3001, other_family.id, "other.recipient@example.com")
    contributor = add_user(db_session, 3002, other_family.id, "other.contributor@example.com")

    response = client.post(
        "/gifts",
        headers=auth_headers,
        json={
            "title": "Forbidden Gift",
            "target_amount": "10.00",
            "family_id": other_family.id,
            "recipient_user_id": recipient.id,
            "custom_allocations": [
                {"user_id": contributor.id, "allocated_amount": "10.00"},
            ],
        },
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "You can only create gifts for your own family"
    assert db_session.query(models.Gift).count() == 0


def test_create_gift_rejects_recipient_outside_gift_family(
    client,
    db_session,
    auth_headers: dict[str, str],
    test_family: models.Family,
) -> None:
    other_family = add_family(db_session)
    external_recipient = add_user(db_session, 3001, other_family.id, "external.recipient@example.com")
    contributor = add_user(db_session, 2002, test_family.id, "contributor@example.com")

    response = client.post(
        "/gifts",
        headers=auth_headers,
        json={
            "title": "Invalid Recipient Gift",
            "target_amount": "10.00",
            "family_id": test_family.id,
            "recipient_user_id": external_recipient.id,
            "custom_allocations": [
                {"user_id": contributor.id, "allocated_amount": "10.00"},
            ],
        },
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["detail"] == "Recipient must exist and belong to the gift family"
    assert db_session.query(models.Gift).count() == 0


def test_update_gift_rejects_paid_contributions(
    client,
    db_session,
    auth_headers: dict[str, str],
    test_family: models.Family,
    authenticated_user: models.User,
) -> None:
    recipient = add_user(db_session, 2002, test_family.id, "recipient@example.com")
    contributor = add_user(db_session, 2003, test_family.id, "contributor@example.com")
    gift = add_gift(db_session, test_family.id, recipient.id, authenticated_user.id)
    contribution = add_contribution(db_session, gift.id, contributor.id, is_paid=True)

    response = client.put(
        f"/gifts/{gift.id}",
        headers=auth_headers,
        json={
            "title": "Updated Gift",
            "target_amount": "20.00",
            "custom_allocations": [
                {"user_id": contributor.id, "allocated_amount": "20.00"},
            ],
        },
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json()["detail"] == "Gift cannot be edited after a participant has paid"

    db_session.refresh(gift)
    db_session.refresh(contribution)
    assert gift.title == "Existing Gift"
    assert gift.target_amount == Decimal("10.00")
    assert contribution.is_paid is True


def test_delete_gift_rejects_paid_contributions(
    client,
    db_session,
    auth_headers: dict[str, str],
    test_family: models.Family,
    authenticated_user: models.User,
) -> None:
    recipient = add_user(db_session, 2002, test_family.id, "recipient@example.com")
    contributor = add_user(db_session, 2003, test_family.id, "contributor@example.com")
    gift = add_gift(db_session, test_family.id, recipient.id, authenticated_user.id)
    contribution = add_contribution(db_session, gift.id, contributor.id, is_paid=True)

    response = client.delete(f"/gifts/{gift.id}", headers=auth_headers)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json()["detail"] == "Gift cannot be deleted after a participant has paid"
    assert db_session.get(models.Gift, gift.id) is not None
    assert db_session.get(models.Contribution, contribution.id) is not None


def test_update_gift_requires_creator(
    client,
    db_session,
    test_family: models.Family,
    authenticated_user: models.User,
) -> None:
    recipient = add_user(db_session, 2002, test_family.id, "recipient@example.com")
    contributor = add_user(db_session, 2003, test_family.id, "contributor@example.com")
    non_creator = add_user(db_session, 2004, test_family.id, "non.creator@example.com")
    gift = add_gift(db_session, test_family.id, recipient.id, authenticated_user.id)
    add_contribution(db_session, gift.id, contributor.id)

    response = client.put(
        f"/gifts/{gift.id}",
        headers=auth_headers_for(non_creator),
        json={
            "title": "Unauthorized Update",
            "target_amount": "10.00",
            "custom_allocations": [
                {"user_id": contributor.id, "allocated_amount": "10.00"},
            ],
        },
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "Only the gift creator can edit this gift"
    db_session.refresh(gift)
    assert gift.title == "Existing Gift"


def test_delete_gift_requires_creator(
    client,
    db_session,
    test_family: models.Family,
    authenticated_user: models.User,
) -> None:
    recipient = add_user(db_session, 2002, test_family.id, "recipient@example.com")
    contributor = add_user(db_session, 2003, test_family.id, "contributor@example.com")
    non_creator = add_user(db_session, 2004, test_family.id, "non.creator@example.com")
    gift = add_gift(db_session, test_family.id, recipient.id, authenticated_user.id)
    add_contribution(db_session, gift.id, contributor.id)

    response = client.delete(f"/gifts/{gift.id}", headers=auth_headers_for(non_creator))

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "Only the gift creator can delete this gift"
    assert db_session.get(models.Gift, gift.id) is not None


def test_payment_webhook_marks_contribution_paid(
    client,
    db_session,
    test_family: models.Family,
    authenticated_user: models.User,
) -> None:
    recipient = add_user(db_session, 2002, test_family.id, "recipient@example.com")
    contributor = add_user(db_session, 2003, test_family.id, "contributor@example.com")
    gift = add_gift(db_session, test_family.id, recipient.id, authenticated_user.id)
    contribution = add_contribution(db_session, gift.id, contributor.id, is_paid=False)

    response = client.post(
        "/payments/webhook",
        headers={"x-webhook-secret": settings.payment_webhook_secret},
        json={"contribution_id": contribution.id},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "contribution_id": contribution.id,
        "is_paid": True,
        "message": "Payment status updated",
    }

    db_session.refresh(contribution)
    assert contribution.is_paid is True


@pytest.mark.parametrize("headers", [{}, {"x-webhook-secret": "invalid-secret"}])
def test_payment_webhook_rejects_missing_or_invalid_secret(
    client,
    db_session,
    headers: dict[str, str],
    test_family: models.Family,
    authenticated_user: models.User,
) -> None:
    recipient = add_user(db_session, 2002, test_family.id, "recipient@example.com")
    contributor = add_user(db_session, 2003, test_family.id, "contributor@example.com")
    gift = add_gift(db_session, test_family.id, recipient.id, authenticated_user.id)
    contribution = add_contribution(db_session, gift.id, contributor.id, is_paid=False)

    response = client.post(
        "/payments/webhook",
        headers=headers,
        json={"contribution_id": contribution.id},
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Invalid webhook secret"

    db_session.refresh(contribution)
    assert contribution.is_paid is False
