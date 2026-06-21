from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.core.database import get_db
from app.core.security import hash_password
from app.id_generator import generate_unique_four_digit_id
from app.routers.auth import get_current_user


router = APIRouter(tags=["entities"])
FOUR_DIGIT_ID_MODELS = (models.Family, models.User)


@router.post("/families", response_model=schemas.FamilyRead, status_code=status.HTTP_201_CREATED)
def create_family(
    payload: schemas.FamilyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Family:
    existing_family = db.scalar(select(models.Family).where(models.Family.name == payload.name))
    if existing_family:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Family name already exists")

    family = models.Family(
        id=generate_unique_four_digit_id(db, models.Family, FOUR_DIGIT_ID_MODELS),
        name=payload.name,
    )
    db.add(family)
    db.commit()
    db.refresh(family)
    return family


@router.get("/families", response_model=list[schemas.FamilyRead])
def list_families(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.Family]:
    return list(db.scalars(select(models.Family).where(models.Family.id == current_user.family_id)).all())


@router.get("/families/{family_id}", response_model=schemas.FamilyRead)
def get_family(
    family_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Family:
    if family_id != current_user.family_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own family")

    family = db.get(models.Family, family_id)
    if family is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family not found")
    return family


@router.get("/families/{family_id}/users", response_model=list[schemas.UserRead])
def list_family_users(
    family_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.User]:
    if family_id != current_user.family_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your own family users")

    family = db.get(models.Family, family_id)
    if family is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family not found")

    return list(
        db.scalars(
            select(models.User).where(models.User.family_id == family_id).order_by(models.User.id)
        ).all()
    )


@router.post("/users", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    existing_user = db.scalar(select(models.User).where(models.User.email == str(payload.email).lower()))
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    if payload.family_id is None and payload.family_name is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either family_id or family_name",
        )

    if payload.family_id is not None:
        if payload.family_id != current_user.family_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only add users to your family")
        family = db.get(models.Family, payload.family_id)
        if family is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family not found")
    else:
        if payload.family_name != current_user.family.name:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only add users to your family")
        family = db.scalar(select(models.Family).where(models.Family.name == payload.family_name))
        if family is None:
            family = models.Family(
                id=generate_unique_four_digit_id(db, models.Family, FOUR_DIGIT_ID_MODELS),
                name=payload.family_name or "",
            )
            db.add(family)
            db.flush()

    user = models.User(
        id=generate_unique_four_digit_id(db, models.User, FOUR_DIGIT_ID_MODELS),
        name=payload.name,
        email=str(payload.email).lower(),
        hashed_password=hash_password(payload.password),
        family_id=family.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[schemas.UserRead])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.User]:
    return list(
        db.scalars(
            select(models.User).where(models.User.family_id == current_user.family_id).order_by(models.User.id)
        ).all()
    )


@router.get("/users/me", response_model=schemas.UserWithFamilyRead)
def get_me(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    user = db.scalar(
        select(models.User)
        .where(models.User.id == current_user.id)
        .options(selectinload(models.User.family))
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.get("/users/{user_id}", response_model=schemas.UserWithFamilyRead)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    user = db.scalar(
        select(models.User).where(models.User.id == user_id).options(selectinload(models.User.family))
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.family_id != current_user.family_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view users in your family")
    return user


@router.post(
    "/contributions",
    response_model=schemas.ContributionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_contribution(
    payload: schemas.ContributionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Contribution:
    user = db.get(models.User, payload.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    gift = db.get(models.Gift, payload.gift_id)
    if gift is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gift not found")

    if user.family_id != gift.family_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contribution user must belong to the gift family",
        )

    if gift.family_id != current_user.family_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create contributions in your own family",
        )

    if user.id == gift.recipient_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gift recipient cannot contribute to their own gift",
        )

    existing_contribution = db.scalar(
        select(models.Contribution)
        .where(models.Contribution.user_id == payload.user_id)
        .where(models.Contribution.gift_id == payload.gift_id)
    )
    if existing_contribution:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contribution already exists for this user and gift",
        )

    contribution = models.Contribution(
        user_id=payload.user_id,
        gift_id=payload.gift_id,
        allocated_amount=payload.allocated_amount,
        is_paid=payload.is_paid,
    )
    db.add(contribution)
    db.commit()
    db.refresh(contribution)
    return contribution


@router.get("/contributions", response_model=list[schemas.ContributionRead])
def list_contributions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.Contribution]:
    return list(
        db.scalars(
            select(models.Contribution)
            .join(models.Contribution.gift)
            .where(models.Gift.family_id == current_user.family_id)
            .order_by(models.Contribution.id)
        ).all()
    )


@router.get("/contributions/{contribution_id}", response_model=schemas.ContributionRead)
def get_contribution(
    contribution_id: int,
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
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only view your family contributions")
    return contribution
