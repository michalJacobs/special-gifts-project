from fastapi import status

from app import models
from app.core.security import hash_password


def test_register_rejects_duplicate_email(client, authenticated_user: models.User, test_family: models.Family) -> None:
    response = client.post(
        "/auth/register",
        json={
            "name": "Duplicate User",
            "email": authenticated_user.email,
            "password": "password123",
            "family_id": test_family.id,
        },
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json()["detail"] == "Email is already registered"


def test_create_family_rejects_duplicate_family_name(client, test_family: models.Family) -> None:
    response = client.post(
        "/auth/create-family",
        json={
            "name": "New Founder",
            "email": "new.founder@example.com",
            "password": "password123",
            "family_name":test_family.name,
        },
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json()["detail"] == "Family name already exists"


def test_login_returns_access_token_for_valid_credentials(
    client,
    db_session,
    test_family: models.Family,
) -> None:
    db_session.add(
        models.User(
            id=3001,
            name="Login User",
            email="login.user@example.com",
            hashed_password=hash_password("password123"),
            family_id=test_family.id,
        )
    )
    db_session.commit()

    response = client.post(
        "/auth/login",
        json={
            "email": "login.user@example.com",
            "password": "password123",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"


def test_login_rejects_invalid_password(client, authenticated_user: models.User) -> None:
    response = client.post(
        "/auth/login",
        json={
            "email": authenticated_user.email,
            "password":"wrong-password",
        },
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Invalid email or password"


def test_protected_route_rejects_invalid_jwt(client) -> None:
    response = client.get("/users/me", headers={"Authorization": "Bearer invalid-token"})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Could not validate credentials"


def test_register_rejects_invalid_email(client, test_family: models.Family) -> None:
    response = client.post(
        "/auth/register",
        json={
            "name": "Invalid Email User",
            "email": "not-an-email",
            "password": "password123",
            "family_id": test_family.id,
        },
    )

    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_register_requires_family_id_or_family_name(client) -> None:
    response = client.post(
        "/auth/register",
        json={
            "name": "No Family User",
            "email": "no.family@example.com",
            "password": "password123",
        },
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["detail"] == "Provide either family_id or family_name"
