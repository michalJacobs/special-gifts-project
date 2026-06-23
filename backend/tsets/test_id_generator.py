import pytest
from fastapi import HTTPException, status

from app import id_generator, models


def test_generate_unique_four_digit_id_returns_available_candidate(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(id_generator.random, "sample", lambda candidate_range, sample_size: [1234])

    generated_id = id_generator.generate_unique_four_digit_id(db_session, models.Family)

    assert generated_id == 1234


def test_generate_unique_four_digit_id_skips_collisions(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    db_session.add(models.Family(id=1234, name="Existing Family"))
    db_session.commit()
    monkeypatch.setattr(id_generator.random, "sample", lambda candidate_range, sample_size: [1234, 1235])

    generated_id = id_generator.generate_unique_four_digit_id(db_session, models.Family)

    assert generated_id == 1235


def test_generate_unique_four_digit_id_checks_all_conflicting_models(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    family = models.Family(id=1001, name="Shared Id Family")
    user = models.User(
        id=1234,
        name="Existing User",
        email="existing.user@example.com",
        hashed_password="test-password-hash",
        family_id=family.id,
    )
    db_session.add_all([family, user])
    db_session.commit()
    monkeypatch.setattr(id_generator.random, "sample", lambda candidate_range, sample_size: [1234, 1235])

    generated_id = id_generator.generate_unique_four_digit_id(
        db_session,
        models.User,
        conflicting_models=(models.Family, models.User),
    )

    assert generated_id == 1235


def test_generate_unique_four_digit_id_raises_conflict_when_id_space_is_exhausted(
    db_session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    exhausted_ids = list(range(id_generator.MIN_FOUR_DIGIT_ID, id_generator.MAX_FOUR_DIGIT_ID + 1))
    monkeypatch.setattr(id_generator.random, "sample", lambda candidate_range, sample_size: exhausted_ids)
    db_session.bulk_save_objects([
        models.Family(id=family_id, name=f"Family {family_id}")
        for family_id in exhausted_ids
    ])
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        id_generator.generate_unique_four_digit_id(db_session, models.Family)

    assert exc_info.value.status_code == status.HTTP_409_CONFLICT
    assert exc_info.value.detail == "No available 4-digit IDs remain for families"
