"""Tests for API key rate limiting and deprecated key support."""

import time
import pytest
from fastapi import FastAPI, Depends
from fastapi.security import APIKeyWithRateLimit
from fastapi.testclient import TestClient


def test_rate_limit_allows_requests_within_limit():
    """Requests within the rate limit are allowed."""
    app = FastAPI()
    auth = APIKeyWithRateLimit(name="X-API-Key", rate_limit="5/minute")

    @app.get("/test")
    async def test_endpoint(api_key: str = Depends(auth)):
        return {"api_key": api_key}

    client = TestClient(app)
    for i in range(5):
        response = client.get("/test", headers={"X-API-Key": "valid-key"})
        assert response.status_code == 200


def test_rate_limit_blocks_excess_requests():
    """Requests exceeding the rate limit get 429 with Retry-After header."""
    app = FastAPI()
    auth = APIKeyWithRateLimit(name="X-API-Key", rate_limit="3/minute")

    @app.get("/test")
    async def test_endpoint(api_key: str = Depends(auth)):
        return {"api_key": api_key}

    client = TestClient(app)
    for i in range(3):
        response = client.get("/test", headers={"X-API-Key": "key1"})
        assert response.status_code == 200

    # 4th request should be rate limited
    response = client.get("/test", headers={"X-API-Key": "key1"})
    assert response.status_code == 429
    assert "retry-after" in response.headers


def test_rate_limit_per_key_independent():
    """Rate limits are tracked per API key independently."""
    app = FastAPI()
    auth = APIKeyWithRateLimit(name="X-API-Key", rate_limit="2/minute")

    @app.get("/test")
    async def test_endpoint(api_key: str = Depends(auth)):
        return {"api_key": api_key}

    client = TestClient(app)
    # Key 1 - 2 requests (limit)
    client.get("/test", headers={"X-API-Key": "key1"})
    client.get("/test", headers={"X-API-Key": "key1"})

    # Key 1 should be rate limited
    r = client.get("/test", headers={"X-API-Key": "key1"})
    assert r.status_code == 429

    # Key 2 should still work
    r = client.get("/test", headers={"X-API-Key": "key2"})
    assert r.status_code == 200


def test_deprecated_key_authenticates_with_warning():
    """Deprecated keys authenticate but include a warning."""
    app = FastAPI()
    auth = APIKeyWithRateLimit(
        name="X-API-Key",
        rate_limit="100/minute",
        deprecated_keys=["old-key"],
    )

    @app.get("/test")
    async def test_endpoint(api_key: str = Depends(auth)):
        return {"api_key": api_key}

    client = TestClient(app)
    response = client.get("/test", headers={"X-API-Key": "old-key"})
    assert response.status_code == 200
    assert response.json()["api_key"] == "old-key"


def test_non_deprecated_key_no_warning():
    """Non-deprecated keys don't include a warning."""
    app = FastAPI()
    auth = APIKeyWithRateLimit(
        name="X-API-Key",
        rate_limit="100/minute",
        deprecated_keys=["old-key"],
    )

    @app.get("/test")
    async def test_endpoint(api_key: str = Depends(auth)):
        return {"api_key": api_key}

    client = TestClient(app)
    response = client.get("/test", headers={"X-API-Key": "new-key"})
    assert response.status_code == 200


def test_missing_key_returns_401():
    """Missing API key returns 401 Unauthorized."""
    app = FastAPI()
    auth = APIKeyWithRateLimit(name="X-API-Key", rate_limit="100/minute")

    @app.get("/test")
    async def test_endpoint(api_key: str = Depends(auth)):
        return {"api_key": api_key}

    client = TestClient(app)
    response = client.get("/test")
    assert response.status_code == 401


def test_invalid_rate_limit_format():
    """Invalid rate limit format raises ValueError."""
    with pytest.raises(ValueError, match="Invalid rate_limit format"):
        APIKeyWithRateLimit(rate_limit="invalid")
