from collections.abc import Generator

import pytest
import resend
from app.core.security import hash_password
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app


TEST_DATABASE_URL = "sqlite:///:memory:"
TEST_FAMILY_ID = 1001
TEST_USER_ID = 2001


@pytest.fixture()
def test_engine() -> Generator[Engine, None, None]:
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(dbapi_connection, connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)

    try:
        yield engine
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def db_session(test_engine: Engine) -> Generator[Session, None, None]:
    testing_session_factory = sessionmaker(
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        bind=test_engine,
    )
    session = testing_session_factory()

    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override


@pytest.fixture()
def test_family(db_session: Session) -> models.Family:
    family = models.Family(
        id=TEST_FAMILY_ID,
        name="Test Family",
    )
    db_session.add(family)
    db_session.commit()
    db_session.refresh(family)
    return family


@pytest.fixture()
def authenticated_user(db_session: Session, test_family: models.Family) -> models.User:
    user = models.User(
        id=TEST_USER_ID,
        name="Authenticated User",
        email="authenticated.user@example.com",
        hashed_password=hash_password("test-password-hash"),
        family_id=test_family.id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def auth_token(authenticated_user: models.User) -> str:
    return create_access_token(subject=authenticated_user.id)


@pytest.fixture()
def auth_headers(auth_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture(autouse=True)
def mock_resend_send(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_send(params: resend.Emails.SendParams) -> dict[str, str]:
        return {"id": "test-email-id"}

    monkeypatch.setattr(resend.Emails, "send", fake_send)
