from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt import InvalidTokenError
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.database import get_db
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.id_generator import generate_unique_four_digit_id


router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
FOUR_DIGIT_ID_MODELS = (models.Family, models.User)


@router.post("/register", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def register_user(payload: schemas.UserCreate, db: Session = Depends(get_db)) -> models.User:
    try:
        normalized_email = str(payload.email).lower()
        existing_user = db.scalar(select(models.User).where(models.User.email == normalized_email))
        if existing_user:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

        if payload.family_id is None and payload.family_name is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide either family_id or family_name",
            )

        if payload.family_id is not None:
            family = db.get(models.Family, payload.family_id)
            if family is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Family not found")
        else:
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
            email=normalized_email,
            hashed_password=hash_password(payload.password),
            family_id=family.id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered") from None
    except Exception:
        db.rollback()
        raise


@router.post("/create-family", response_model=schemas.AuthWithUser, status_code=status.HTTP_201_CREATED)
def create_family_with_founder(
    payload: schemas.UserAndFamilyRegistrationRequest,
    db: Session = Depends(get_db),
) -> schemas.AuthWithUser:
    normalized_email = str(payload.email).lower()
    hashed_password = hash_password(payload.password)

    existing_user = db.scalar(select(models.User).where(models.User.email == normalized_email))
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    existing_family = db.scalar(select(models.Family).where(models.Family.name == payload.family_name))
    if existing_family:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Family name already exists")

    try:
        family = models.Family(
            id=generate_unique_four_digit_id(db, models.Family, FOUR_DIGIT_ID_MODELS),
            name=payload.family_name,
        )
        db.add(family)
        db.flush() 

        user = models.User(
            id=generate_unique_four_digit_id(db, models.User, FOUR_DIGIT_ID_MODELS),
            name=payload.name,
            email=normalized_email,
            hashed_password=hashed_password,
            family_id=family.id,
        )
        db.add(user)
        db.commit() 
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create user and family because a unique value already exists",
        ) from None
    except Exception:
        db.rollback()
        raise

    db.refresh(family)
    db.refresh(user)

    return schemas.AuthWithUser(
        access_token=create_access_token(subject=user.id),
        user=user,
        family=family,
    )

@router.post("/login", response_model=schemas.Token)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)) -> schemas.Token:
    user = db.scalar(select(models.User).where(models.User.email == str(payload.email).lower()))
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return schemas.Token(access_token=create_access_token(subject=user.id))


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except (InvalidTokenError, TypeError, ValueError):
        raise credentials_exception from None

    user = db.get(models.User, user_id)
    if user is None:
        raise credentials_exception
    return user
