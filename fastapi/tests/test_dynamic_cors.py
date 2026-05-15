"""Tests for DynamicCORSMiddleware."""

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import DynamicCORSMiddleware
from fastapi.testclient import TestClient


def test_dynamic_cors_allows_matching_origin():
    """Dynamic callback returning True allows the origin."""
    app = FastAPI()

    def allow_local(origin: str) -> bool:
        return origin == "http://localhost:3000"

    app.add_middleware(
        DynamicCORSMiddleware,
        allow_origin_func=allow_local,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @app.get("/test")
    async def test_endpoint():
        return {"ok": True}

    client = TestClient(app)
    response = client.get(
        "/test", headers={"Origin": "http://localhost:3000"}
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_dynamic_cors_denies_non_matching_origin():
    """Dynamic callback returning False denies the origin."""
    app = FastAPI()

    def allow_local(origin: str) -> bool:
        return origin == "http://localhost:3000"

    app.add_middleware(
        DynamicCORSMiddleware,
        allow_origin_func=allow_local,
        allow_methods=["GET"],
    )

    @app.get("/test")
    async def test_endpoint():
        return {"ok": True}

    client = TestClient(app)
    response = client.get(
        "/test", headers={"Origin": "http://evil.com"}
    )
    assert response.headers.get("access-control-allow-origin") is None


def test_dynamic_cors_async_callback():
    """Async callbacks are properly awaited."""
    app = FastAPI()

    async def async_allow(origin: str) -> bool:
        return origin.endswith(".example.com")

    app.add_middleware(
        DynamicCORSMiddleware,
        allow_origin_func=async_allow,
        allow_methods=["GET"],
    )

    @app.get("/test")
    async def test_endpoint():
        return {"ok": True}

    client = TestClient(app)
    response = client.get(
        "/test", headers={"Origin": "https://app.example.com"}
    )
    assert response.headers.get("access-control-allow-origin") == "https://app.example.com"


def test_dynamic_cors_fallback_to_static_list():
    """When no callback is provided, falls back to static allow_origins."""
    app = FastAPI()

    app.add_middleware(
        DynamicCORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_methods=["GET"],
    )

    @app.get("/test")
    async def test_endpoint():
        return {"ok": True}

    client = TestClient(app)
    response = client.get(
        "/test", headers={"Origin": "http://localhost:3000"}
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_dynamic_cors_preflight():
    """Preflight requests return correct CORS headers."""
    app = FastAPI()

    def allow_all(origin: str) -> bool:
        return True

    app.add_middleware(
        DynamicCORSMiddleware,
        allow_origin_func=allow_all,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        cors_max_age=3600,
    )

    @app.get("/test")
    async def test_endpoint():
        return {"ok": True}

    client = TestClient(app)
    response = client.options(
        "/test", headers={"Origin": "http://localhost:3000"}
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-max-age") == "3600"


def test_existing_cors_middleware_import():
    """Existing CORSMiddleware import still works."""
    from starlette.middleware.cors import CORSMiddleware
    assert CORSMiddleware is not None
