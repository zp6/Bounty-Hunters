"""Tests for OAuth2 token refresh support."""

import pytest
from fastapi import FastAPI, Depends
from fastapi.security import (
    OAuth2PasswordBearerWithRefresh,
    OAuth2RefreshRequestForm,
)
from fastapi.testclient import TestClient


def test_oauth2_password_bearer_with_refresh_drop_in_replacement():
    """OAuth2PasswordBearerWithRefresh works as drop-in for OAuth2PasswordBearer."""
    app = FastAPI()
    oauth2 = OAuth2PasswordBearerWithRefresh(
        tokenUrl="/token",
        refreshUrl="/refresh",
    )

    @app.get("/test")
    async def test_endpoint(token: str = Depends(oauth2)):
        return {"token": token}

    client = TestClient(app)
    response = client.get(
        "/test", headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 200
    assert response.json() == {"token": "test-token"}


def test_oauth2_password_bearer_with_refresh_missing_token():
    """Missing token returns 401."""
    app = FastAPI()
    oauth2 = OAuth2PasswordBearerWithRefresh(
        tokenUrl="/token",
        refreshUrl="/refresh",
    )

    @app.get("/test")
    async def test_endpoint(token: str = Depends(oauth2)):
        return {"token": token}

    client = TestClient(app)
    response = client.get("/test")
    assert response.status_code == 401


def test_oauth2_password_bearer_with_refresh_openapi():
    """refresh_url appears in OpenAPI schema."""
    app = FastAPI()
    oauth2 = OAuth2PasswordBearerWithRefresh(
        tokenUrl="/token",
        refreshUrl="/refresh",
    )

    @app.get("/test")
    async def test_endpoint(token: str = Depends(oauth2)):
        return {"token": token}

    response = TestClient(app).get("/openapi.json")
    schema = response.json()
    security_schemes = schema.get("components", {}).get("securitySchemes", {})
    assert "OAuth2PasswordBearerWithRefresh" in security_schemes
    scheme = security_schemes["OAuth2PasswordBearerWithRefresh"]
    flows = scheme.get("flows", {}).get("password", {})
    assert flows.get("tokenUrl") == "/token"
    assert flows.get("refreshUrl") == "/refresh"


def test_oauth2_refresh_request_form():
    """OAuth2RefreshRequestForm validates grant_type=refresh_token."""
    app = FastAPI()

    @app.post("/refresh")
    async def refresh(form_data: OAuth2RefreshRequestForm = Depends()):
        return {
            "grant_type": form_data.grant_type,
            "refresh_token": form_data.refresh_token,
            "scopes": form_data.scopes,
        }

    client = TestClient(app)
    response = client.post(
        "/refresh",
        data={
            "grant_type": "refresh_token",
            "refresh_token": "my-refresh-token",
            "scope": "read write",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["grant_type"] == "refresh_token"
    assert data["refresh_token"] == "my-refresh-token"
    assert data["scopes"] == ["read", "write"]


def test_oauth2_refresh_request_form_invalid_grant_type():
    """Invalid grant_type is rejected."""
    app = FastAPI()

    @app.post("/refresh")
    async def refresh(form_data: OAuth2RefreshRequestForm = Depends()):
        return {"ok": True}

    client = TestClient(app)
    response = client.post(
        "/refresh",
        data={
            "grant_type": "password",
            "refresh_token": "my-refresh-token",
        },
    )
    assert response.status_code == 422


def test_oauth2_password_bearer_with_refresh_without_refresh_url():
    """Works without refresh_url parameter."""
    app = FastAPI()
    oauth2 = OAuth2PasswordBearerWithRefresh(tokenUrl="/token")

    @app.get("/test")
    async def test_endpoint(token: str = Depends(oauth2)):
        return {"token": token}

    client = TestClient(app)
    response = client.get(
        "/test", headers={"Authorization": "Bearer mytoken"}
    )
    assert response.status_code == 200


def test_oauth2_password_bearer_with_refresh_optional():
    """auto_error=False returns None instead of raising."""
    app = FastAPI()
    oauth2 = OAuth2PasswordBearerWithRefresh(
        tokenUrl="/token",
        auto_error=False,
    )

    @app.get("/test")
    async def test_endpoint(token: str | None = Depends(oauth2)):
        return {"token": token}

    client = TestClient(app)
    response = client.get("/test")
    assert response.status_code == 200
    assert response.json() == {"token": None}


def test_existing_oauth2_password_bearer_unchanged():
    """Existing OAuth2PasswordBearer behavior is not modified."""
    from fastapi.security import OAuth2PasswordBearer

    app = FastAPI()
    oauth2 = OAuth2PasswordBearer(tokenUrl="/token")

    @app.get("/test")
    async def test_endpoint(token: str = Depends(oauth2)):
        return {"token": token}

    client = TestClient(app)
    response = client.get(
        "/test", headers={"Authorization": "Bearer test-token"}
    )
    assert response.status_code == 200
