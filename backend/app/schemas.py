from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class FamilyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class FamilyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)
    family_id: int | None = None
    family_name: str | None = Field(default=None, min_length=1, max_length=255)


class FamilyFounderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8)
    family_name: str = Field(..., min_length=1, max_length=255)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    family_id: int


class UserWithFamilyRead(UserRead):
    family: FamilyRead


class AuthWithUser(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
    family: FamilyRead


class ContributionAllocation(BaseModel):
    user_id: int
    allocated_amount: Decimal = Field(..., ge=0, decimal_places=2)


class GiftCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    target_amount: Decimal = Field(..., gt=0, decimal_places=2)
    family_id: int
    recipient_user_id: int
    custom_allocations: list[ContributionAllocation] | None = None


class GiftUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    target_amount: Decimal = Field(..., gt=0, decimal_places=2)
    custom_allocations: list[ContributionAllocation]


class ContributionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    gift_id: int
    allocated_amount: Decimal
    is_paid: bool


class ContributionCreate(BaseModel):
    user_id: int
    gift_id: int
    allocated_amount: Decimal = Field(..., ge=0, decimal_places=2)
    is_paid: bool = False


class GiftRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    target_amount: Decimal
    family_id: int
    recipient_user_id: int
    creator_user_id: int | None = None
    contributions: list[ContributionRead] = []


class ContributionUpdate(BaseModel):
    allocated_amount: Decimal = Field(..., ge=0, decimal_places=2)


class PaymentWebhook(BaseModel):
    contribution_id: int


class PaymentWebhookResponse(BaseModel):
    contribution_id: int
    is_paid: bool
    message: str
