import asyncio
import logging
from decimal import Decimal, ROUND_HALF_UP
from html import escape

import resend
from sqlalchemy.orm import Session

from app import models
from app.core.config import settings


logger = logging.getLogger(__name__)


def split_amount_equally(total_amount: Decimal, contributor_count: int) -> list[Decimal]:
    """Split money into cent-accurate amounts whose sum equals total_amount."""
    if contributor_count <= 0:
        return []

    cents = int((total_amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    base_cents, remainder = divmod(cents, contributor_count)
    return [
        Decimal(base_cents + (1 if index < remainder else 0)) / Decimal("100")
        for index in range(contributor_count)
    ]


async def send_payment_request_email(
    to_email: str,
    gift_title: str,
    allocated_amount: float,
    creator_name: str,
) -> None:
    if not settings.resend_api_key:
        logger.warning("Skipping payment email to %s because RESEND_API_KEY is not configured", to_email)
        return

    resend.api_key = settings.resend_api_key
    formatted_amount = f"{allocated_amount:,.2f}"
    safe_gift_title = escape(gift_title)
    safe_creator_name = escape(creator_name)

    params: resend.Emails.SendParams = {
        "from": f"Family Gift Fund <{settings.mail_from_address}>",
        "to": [to_email],
        "subject": f"בקשת השתתפות במתנה: {gift_title}",
        "html": f"""
        <!doctype html>
        <html lang="he" dir="rtl">
          <body style="margin:0;background:#f8faf7;font-family:Arial,Helvetica,sans-serif;color:#1f2933;direction:rtl;text-align:right;">
            <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
              <div style="background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden;">
                <div style="background:#3f5f46;color:#ffffff;padding:24px 28px;">
                  <h1 style="margin:0;font-size:24px;line-height:1.35;">בקשת השתתפות במתנה</h1>
                </div>
                <div style="padding:28px;">
                  <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">
                    שלום,
                  </p>
                  <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">
                    {safe_creator_name} יצר/ה מתנה בשם
                    <strong>{safe_gift_title}</strong>
                    וביקש/ה את השתתפותך.
                  </p>
                  <div style="margin:24px 0;padding:20px;border-radius:10px;background:#edf6ef;border:1px solid #cfe5d4;">
                    <div style="font-size:14px;color:#52645a;margin-bottom:6px;">הסכום לתשלום</div>
                    <div style="font-size:32px;font-weight:700;color:#274431;">₪{formatted_amount}</div>
                  </div>
                  <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">
                    ניתן להשלים את התשלום דרך קופת המתנות המשפחתית ולעדכן את סטטוס ההשתתפות.
                  </p>
                  <p style="margin:24px 0 0;font-size:13px;color:#78716c;line-height:1.6;">
                    הודעה זו נשלחה אוטומטית ממערכת Family Gift Fund.
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
        """,
    }

    try:
        await asyncio.to_thread(resend.Emails.send, params)
    except Exception:
        logger.exception("Failed to send Resend payment request email to %s", to_email)


def mark_contribution_paid(db: Session, contribution_id: int) -> models.Contribution | None:
    contribution = db.get(models.Contribution, contribution_id)
    if contribution is None:
        return None

    contribution.is_paid = True
    db.add(contribution)
    db.commit()
    db.refresh(contribution)
    return contribution
