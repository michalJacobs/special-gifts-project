import asyncio
import logging
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from html import escape
from typing import Protocol, Sequence

import resend
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.core.config import settings
from app.core.constants import CENT, WHOLE_CENT, ZERO_MONEY_AMOUNT
from app.core.email_templates import (
    EMAIL_AMOUNT_BOX_STYLE,
    EMAIL_AMOUNT_LABEL_STYLE,
    EMAIL_AMOUNT_VALUE_STYLE,
    EMAIL_BODY_STYLE,
    EMAIL_CARD_STYLE,
    EMAIL_CANCELLATION_HEADER_BACKGROUND,
    EMAIL_CONTENT_STYLE,
    EMAIL_CONTAINER_STYLE,
    EMAIL_FOOTER_STYLE,
    EMAIL_HEADER_STYLE_TEMPLATE,
    EMAIL_HEADER_TITLE_STYLE,
    EMAIL_PARAGRAPH_STYLE,
    EMAIL_PAYMENT_HEADER_BACKGROUND,
)


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailDraft:
    subject: str
    html: str


class ContributionAllocationInput(Protocol):
    user_id: int
    allocated_amount: Decimal


class AllocationValidationError(ValueError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


def split_amount_equally(total_amount: Decimal, contributor_count: int) -> list[Decimal]:
    """Split money into cent-accurate amounts whose sum equals total_amount."""
    if contributor_count <= 0:
        return []

    total_cents = int((total_amount * CENT).quantize(WHOLE_CENT, rounding=ROUND_HALF_UP))
    base_cents_per_contributor, extra_cent_count = divmod(total_cents, contributor_count)
    return [
        Decimal(base_cents_per_contributor + (1 if contributor_index < extra_cent_count else 0)) / CENT
        for contributor_index in range(contributor_count)
    ]


def validate_contribution_allocations(
    db: Session,
    family_id: int,
    recipient_user_id: int,
    target_amount: Decimal,
    custom_allocations: Sequence[ContributionAllocationInput] | None,
) -> list[tuple[models.User, Decimal]]:
    if custom_allocations is None:
        contributors = _get_default_gift_contributors(db, family_id, recipient_user_id)
        if not contributors:
            raise AllocationValidationError("At least one non-recipient family member is required")

        equal_allocations = split_amount_equally(target_amount, len(contributors))
        return list(zip(contributors, equal_allocations, strict=True))

    if not custom_allocations:
        raise AllocationValidationError("At least one participant is required")

    participant_user_ids = [allocation.user_id for allocation in custom_allocations]
    _validate_participant_ids(participant_user_ids, recipient_user_id)

    contributor_by_id = _get_family_contributors_by_id(db, family_id, participant_user_ids)
    missing_user_ids = [
        user_id for user_id in participant_user_ids
        if user_id not in contributor_by_id
    ]
    if missing_user_ids:
        raise AllocationValidationError("All participants must belong to the gift family")

    _validate_total_allocated_amount(custom_allocations, target_amount)
    return [
        (contributor_by_id[allocation.user_id], allocation.allocated_amount)
        for allocation in custom_allocations
    ]


async def send_payment_request_email(
    to_email: str,
    gift_title: str,
    allocated_amount: float,
    creator_name: str,
) -> None:
    email_draft = _build_payment_request_email(gift_title, allocated_amount, creator_name)
    await _send_resend_email(
        to_email=to_email,
        email_draft=email_draft,
        email_purpose="payment request",
    )


async def send_gift_cancellation_email(
    to_email: str,
    gift_title: str,
    creator_name: str,
) -> None:
    email_draft = _build_gift_cancellation_email(gift_title, creator_name)
    await _send_resend_email(
        to_email=to_email,
        email_draft=email_draft,
        email_purpose="cancellation",
    )


async def send_contribution_amount_changed_email(
    to_email: str,
    gift_title: str,
    allocated_amount: float,
    creator_name: str,
) -> None:
    email_draft = _build_contribution_amount_changed_email(gift_title, allocated_amount, creator_name)
    await _send_resend_email(
        to_email=to_email,
        email_draft=email_draft,
        email_purpose="amount changed",
    )


def mark_contribution_paid(db: Session, contribution_id: int) -> models.Contribution | None:
    contribution = db.get(models.Contribution, contribution_id)
    if contribution is None:
        return None

    contribution.is_paid = True
    db.add(contribution)
    db.commit()
    db.refresh(contribution)
    return contribution


def _get_default_gift_contributors(
    db: Session,
    family_id: int,
    recipient_user_id: int,
) -> list[models.User]:
    return list(
        db.scalars(
            select(models.User)
            .where(models.User.family_id == family_id)
            .where(models.User.id != recipient_user_id)
            .order_by(models.User.id)
        ).all()
    )


def _get_family_contributors_by_id(
    db: Session,
    family_id: int,
    participant_user_ids: Sequence[int],
) -> dict[int, models.User]:
    contributors = db.scalars(
        select(models.User)
        .where(models.User.family_id == family_id)
        .where(models.User.id.in_(participant_user_ids))
    ).all()
    return {user.id: user for user in contributors}


def _validate_participant_ids(
    participant_user_ids: Sequence[int],
    recipient_user_id: int,
) -> None:
    if len(participant_user_ids) != len(set(participant_user_ids)):
        raise AllocationValidationError("Participant list cannot contain duplicates")

    if recipient_user_id in participant_user_ids:
        raise AllocationValidationError("Gift recipient cannot contribute to their own gift")


def _validate_total_allocated_amount(
    custom_allocations: Sequence[ContributionAllocationInput],
    target_amount: Decimal,
) -> None:
    total_allocated = sum(
        (allocation.allocated_amount for allocation in custom_allocations),
        ZERO_MONEY_AMOUNT,
    )
    if total_allocated != target_amount:
        raise AllocationValidationError("Contribution allocations must exactly equal the target amount")


def _build_payment_request_email(
    gift_title: str,
    allocated_amount: float,
    creator_name: str,
) -> EmailDraft:
    escaped_gift_title = escape(gift_title)
    escaped_creator_name = escape(creator_name)
    formatted_amount = _format_money_amount(allocated_amount)

    email_content = f"""
      <p style="{EMAIL_PARAGRAPH_STYLE}">
        שלום,
      </p>
      <p style="{EMAIL_PARAGRAPH_STYLE}">
        {escaped_creator_name} יצר/ה מתנה בשם
        <strong>{escaped_gift_title}</strong>
        וביקש/ה את השתתפותך.
      </p>
      {_render_amount_panel("הסכום לתשלום", formatted_amount)}
      <p style="{EMAIL_PARAGRAPH_STYLE}">
        ניתן להשלים את התשלום דרך קופת המתנות המשפחתית ולעדכן את סטטוס ההשתתפות.
      </p>
      {_render_system_footer()}
    """

    return EmailDraft(
        subject=f"בקשת השתתפות במתנה: {gift_title}",
        html=_render_email_layout(
            header_text="בקשת השתתפות במתנה",
            header_background=EMAIL_PAYMENT_HEADER_BACKGROUND,
            content_html=email_content,
        ),
    )


def _build_gift_cancellation_email(gift_title: str, creator_name: str) -> EmailDraft:
    escaped_gift_title = escape(gift_title)
    escaped_creator_name = escape(creator_name)

    email_content = f"""
      <p style="{EMAIL_PARAGRAPH_STYLE}">
        שלום,
      </p>
      <p style="{EMAIL_PARAGRAPH_STYLE}">
        {escaped_creator_name} ביטל/ה את המתנה
        <strong>{escaped_gift_title}</strong>.
      </p>
      <p style="{EMAIL_PARAGRAPH_STYLE}">
        אין צורך להשלים תשלום עבור מתנה זו. אם כבר שילמת, מומלץ לתאם החזר ישירות עם יוצר/ת המתנה.
      </p>
      {_render_system_footer()}
    """

    return EmailDraft(
        subject=f"ביטול מתנה: {gift_title}",
        html=_render_email_layout(
            header_text="המתנה בוטלה",
            header_background=EMAIL_CANCELLATION_HEADER_BACKGROUND,
            content_html=email_content,
        ),
    )


def _build_contribution_amount_changed_email(
    gift_title: str,
    allocated_amount: float,
    creator_name: str,
) -> EmailDraft:
    escaped_gift_title = escape(gift_title)
    escaped_creator_name = escape(creator_name)
    formatted_amount = _format_money_amount(allocated_amount)

    email_content = f"""
      <p style="{EMAIL_PARAGRAPH_STYLE}">
        שלום,
      </p>
      <p style="{EMAIL_PARAGRAPH_STYLE}">
        {escaped_creator_name} עדכן/ה את סכום ההשתתפות שלך במתנה
        <strong>{escaped_gift_title}</strong>.
      </p>
      {_render_amount_panel("הסכום החדש לתשלום", formatted_amount)}
      {_render_system_footer()}
    """

    return EmailDraft(
        subject=f"עדכון סכום השתתפות במתנה: {gift_title}",
        html=_render_email_layout(
            header_text="סכום ההשתתפות עודכן",
            header_background=EMAIL_PAYMENT_HEADER_BACKGROUND,
            content_html=email_content,
        ),
    )


def _format_money_amount(amount: float) -> str:
    return f"{amount:,.2f}"


def _render_amount_panel(label: str, formatted_amount: str) -> str:
    return f"""
      <div style="{EMAIL_AMOUNT_BOX_STYLE}">
        <div style="{EMAIL_AMOUNT_LABEL_STYLE}">{label}</div>
        <div style="{EMAIL_AMOUNT_VALUE_STYLE}">₪{formatted_amount}</div>
      </div>
    """


def _render_system_footer() -> str:
    return f"""
      <p style="{EMAIL_FOOTER_STYLE}">
        הודעה זו נשלחה אוטומטית ממערכת Family Gift Fund.
      </p>
    """


def _render_email_layout(header_text: str, header_background: str, content_html: str) -> str:
    header_style = EMAIL_HEADER_STYLE_TEMPLATE.format(header_background=header_background)

    return f"""
    <!doctype html>
    <html lang="he" dir="rtl">
      <body style="{EMAIL_BODY_STYLE}">
        <div style="{EMAIL_CONTAINER_STYLE}">
          <div style="{EMAIL_CARD_STYLE}">
            <div style="{header_style}">
              <h1 style="{EMAIL_HEADER_TITLE_STYLE}">{header_text}</h1>
            </div>
            <div style="{EMAIL_CONTENT_STYLE}">
              {content_html}
            </div>
          </div>
        </div>
      </body>
    </html>
    """


async def _send_resend_email(
    to_email: str,
    email_draft: EmailDraft,
    email_purpose: str,
) -> None:
    if not settings.resend_api_key:
        logger.warning(
            "Skipping %s email to %s because RESEND_API_KEY is not configured",
            email_purpose,
            to_email,
        )
        return

    resend.api_key = settings.resend_api_key
    email_params = _build_resend_send_params(to_email, email_draft)

    try:
        await asyncio.to_thread(resend.Emails.send, email_params)
    except Exception:
        logger.exception("Failed to send Resend %s email to %s", email_purpose, to_email)


def _build_resend_send_params(
    to_email: str,
    email_draft: EmailDraft,
) -> resend.Emails.SendParams:
    return {
        "from": f"Family Gift Fund <{settings.mail_from_address}>",
        "to": [to_email],
        "subject": email_draft.subject,
        "html": email_draft.html,
    }
