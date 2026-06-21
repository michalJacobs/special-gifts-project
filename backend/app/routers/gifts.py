from decimal import Decimal
from hmac import compare_digest

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.core.config import settings
from app.core.database import get_db
from app.routers.auth import get_current_user
from app.services import (
    AllocationValidationError,
    mark_contribution_paid,
    send_contribution_amount_changed_email,
    send_gift_cancellation_email,
    send_payment_request_email,
    validate_contribution_allocations,
)


router = APIRouter(tags=["gifts"])


def _validate_allocations(
    db: Session,
    family_id: int,
    recipient_user_id: int,
    target_amount: Decimal,
    custom_allocations: list[schemas.ContributionAllocation] | None,
) -> list[tuple[models.User, Decimal]]:
    try:
        return validate_contribution_allocations(
            db,
            family_id,
            recipient_user_id,
            target_amount,
            custom_allocations,
        )
    except AllocationValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.detail,
        ) from exc


@router.post("/gifts", response_model=schemas.GiftRead, status_code=status.HTTP_201_CREATED)
def create_gift(
    payload: schemas.GiftCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Gift:
    family = db.get(models.Family, payload.family_id)
    if family is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family not found")

    recipient = db.get(models.User, payload.recipient_user_id)
    if recipient is None or recipient.family_id != payload.family_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipient must exist and belong to the gift family",
        )

    if current_user.family_id != payload.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create gifts for your own family",
        )

    contribution_allocations = _validate_allocations(
        db,
        payload.family_id,
        payload.recipient_user_id,
        Decimal(payload.target_amount),
        payload.custom_allocations,
    )

    gift = models.Gift(
        title=payload.title,
        target_amount=payload.target_amount,
        family_id=payload.family_id,
        recipient_user_id=payload.recipient_user_id,
        creator_user_id=current_user.id,
    )
    db.add(gift)
    db.flush()

    for contributor, allocated_amount in contribution_allocations:
        contribution = models.Contribution(
            user_id=contributor.id,
            gift_id=gift.id,
            allocated_amount=allocated_amount,
        )
        db.add(contribution)
        background_tasks.add_task(
            send_payment_request_email,
            contributor.email,
            payload.title,
            float(allocated_amount),
            current_user.name,
        )

    db.commit()

    created_gift = db.scalar(
        select(models.Gift)
        .where(models.Gift.id == gift.id)
        .options(selectinload(models.Gift.contributions))
    )
    if created_gift is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Gift creation failed")
    return created_gift


@router.put("/gifts/{gift_id}", response_model=schemas.GiftRead)
def update_gift(
    gift_id: int,
    payload: schemas.GiftUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Gift:
    gift = db.scalar(
        select(models.Gift)
        .where(models.Gift.id == gift_id)
        .options(selectinload(models.Gift.contributions).selectinload(models.Contribution.user))
    )
    if gift is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift not found")

    if gift.family_id != current_user.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit gifts in your own family",
        )

    if gift.creator_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the gift creator can edit this gift",
        )

    if any(contribution.is_paid for contribution in gift.contributions):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Gift cannot be edited after a participant has paid",
        )

    previous_amount_by_user_id = {
        contribution.user_id: contribution.allocated_amount
        for contribution in gift.contributions
    }

    contribution_allocations = _validate_allocations(
        db,
        gift.family_id,
        gift.recipient_user_id,
        Decimal(payload.target_amount),
        payload.custom_allocations,
    )

    gift.title = payload.title
    gift.target_amount = payload.target_amount

    for contribution in list(gift.contributions):
        db.delete(contribution)
    db.flush()

    for contributor, allocated_amount in contribution_allocations:
        db.add(
            models.Contribution(
                user_id=contributor.id,
                gift_id=gift.id,
                allocated_amount=allocated_amount,
            )
        )
        if previous_amount_by_user_id.get(contributor.id) != allocated_amount:
            background_tasks.add_task(
                send_contribution_amount_changed_email,
                contributor.email,
                payload.title,
                float(allocated_amount),
                current_user.name,
            )

    db.commit()

    updated_gift = db.scalar(
        select(models.Gift)
        .where(models.Gift.id == gift.id)
        .options(selectinload(models.Gift.contributions))
        .execution_options(populate_existing=True)
    )
    if updated_gift is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Gift update failed")
    return updated_gift


@router.delete("/gifts/{gift_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gift(
    gift_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> None:
    gift = db.scalar(
        select(models.Gift)
        .where(models.Gift.id == gift_id)
        .options(selectinload(models.Gift.contributions).selectinload(models.Contribution.user))
    )
    if gift is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift not found")

    if gift.family_id != current_user.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete gifts in your own family",
        )

    if gift.creator_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the gift creator can delete this gift",
        )

    if any(contribution.is_paid for contribution in gift.contributions):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Gift cannot be deleted after a participant has paid",
        )

    recipient_emails = {contribution.user.email for contribution in gift.contributions}
    for to_email in recipient_emails:
        background_tasks.add_task(
            send_gift_cancellation_email,
            to_email,
            gift.title,
            current_user.name,
        )

    db.delete(gift)
    db.commit()


@router.get("/gifts", response_model=list[schemas.GiftRead])
def list_gifts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.Gift]:
    return list(
        db.scalars(
            select(models.Gift)
            .where(models.Gift.family_id == current_user.family_id)
            .options(selectinload(models.Gift.contributions))
            .order_by(models.Gift.id)
        ).all()
    )


@router.get("/gifts/{gift_id}", response_model=schemas.GiftRead)
def get_gift(
    gift_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Gift:
    gift = db.scalar(
        select(models.Gift)
        .where(models.Gift.id == gift_id)
        .options(selectinload(models.Gift.contributions))
    )
    if gift is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift not found")

    if gift.family_id != current_user.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view gifts in your own family",
        )

    return gift


@router.patch("/contributions/{contribution_id}", response_model=schemas.ContributionRead)
def update_contribution(
    contribution_id: int,
    payload: schemas.ContributionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Contribution:
    contribution = db.scalar(
        select(models.Contribution)
        .where(models.Contribution.id == contribution_id)
        .options(selectinload(models.Contribution.gift))
    )
    if contribution is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contribution not found")

    if contribution.gift.family_id != current_user.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update contributions in your own family",
        )

    contribution.allocated_amount = payload.allocated_amount
    db.add(contribution)
    db.commit()
    db.refresh(contribution)
    return contribution


@router.post("/payments/webhook", response_model=schemas.PaymentWebhookResponse)
def payment_webhook(
    payload: schemas.PaymentWebhook,
    x_webhook_secret: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> schemas.PaymentWebhookResponse:
    if not x_webhook_secret or not compare_digest(x_webhook_secret, settings.payment_webhook_secret):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook secret")

    contribution = mark_contribution_paid(db, payload.contribution_id)
    if contribution is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contribution not found")

    return schemas.PaymentWebhookResponse(
        contribution_id=contribution.id,
        is_paid=contribution.is_paid,
        message="Payment status updated",
    )
