from random import SystemRandom
from collections.abc import Sequence
from typing import TypeVar

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import Base


MIN_FOUR_DIGIT_ID = 1000
MAX_FOUR_DIGIT_ID = 9999
ID_SPACE_SIZE = MAX_FOUR_DIGIT_ID - MIN_FOUR_DIGIT_ID + 1

ModelT = TypeVar("ModelT", bound=Base)
random = SystemRandom()


def generate_unique_four_digit_id(
    db: Session,
    model: type[ModelT],
    conflicting_models: Sequence[type[Base]] | None = None,
) -> int:
    models_to_check = tuple(conflicting_models or (model,))

    for candidate_id in random.sample(range(MIN_FOUR_DIGIT_ID, MAX_FOUR_DIGIT_ID + 1), ID_SPACE_SIZE):
        if all(db.get(conflicting_model, candidate_id) is None for conflicting_model in models_to_check):
            return candidate_id

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=f"No available 4-digit IDs remain for {model.__tablename__}",
    )
