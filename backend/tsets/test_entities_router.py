from fastapi import status

from app import models


def add_other_family(db_session) -> models.Family:
    family = models.Family(id=1002, name="Other Family")
    db_session.add(family)
    db_session.commit()
    db_session.refresh(family)
    return family


def add_other_family_user(db_session, family: models.Family) -> models.User:
    user = models.User(
        id=2002,
        name="Other User",
        email="other.user@example.com",
        hashed_password="test-password-hash",
        family_id=family.id,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_get_family_returns_current_users_family(
    client,
    auth_headers: dict[str, str],
    test_family: models.Family,
) -> None:
    response = client.get(f"/families/{test_family.id}", headers=auth_headers)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "id": test_family.id,
        "name": test_family.name,
    }


def test_get_family_for_other_family_returns_forbidden(
    client,
    db_session,
    auth_headers: dict[str, str],
) -> None:
    other_family = add_other_family(db_session)

    response = client.get(f"/families/{other_family.id}", headers=auth_headers)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "You can only view your own family"


def test_list_family_users_for_other_family_returns_forbidden(
    client,
    db_session,
    auth_headers: dict[str, str],
) -> None:
    other_family = add_other_family(db_session)

    response = client.get(f"/families/{other_family.id}/users", headers=auth_headers)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "You can only view your own family users"


def test_get_user_from_other_family_returns_forbidden(
    client,
    db_session,
    auth_headers: dict[str, str],
) -> None:
    other_family = add_other_family(db_session)
    other_user = add_other_family_user(db_session, other_family)

    response = client.get(f"/users/{other_user.id}", headers=auth_headers)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "You can only view users in your family"


def test_create_user_in_other_family_by_id_returns_forbidden(
    client,
    db_session,
    auth_headers: dict[str, str],
) -> None:
    other_family = add_other_family(db_session)

    response = client.post(
        "/users",
        headers=auth_headers,
        json={
            "name": "Cross Family User",
            "email": "cross.family@example.com",
            "password": "password123",
            "family_id": other_family.id,
        },
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "You can only add users to your family"


def test_create_user_in_other_family_by_name_returns_forbidden(
    client,
    db_session,
    auth_headers: dict[str, str],
) -> None:
    other_family = add_other_family(db_session)

    response = client.post(
        "/users",
        headers=auth_headers,
        json={
            "name": "Cross Family User",
            "email": "cross.family.name@example.com",
            "password": "password123",
            "family_name": other_family.name,
        },
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["detail"] == "You can only add users to your family"
