"""
Enhanced test client with auth helpers. Fixes #804
"""
import base64
from contextlib import contextmanager
from typing import Any, Dict, List, Optional
from starlette.testclient import TestClient


class FastAPITestClient(TestClient):
    def __init__(self, app, **kwargs):
        super().__init__(app, **kwargs)
        self._auth_headers = {}

    def authenticate(self, token: str):
        self._auth_headers["Authorization"] = f"Bearer {token}"

    def authenticate_basic(self, username: str, password: str):
        cred = base64.b64encode(f"{username}:{password}".encode()).decode()
        self._auth_headers["Authorization"] = f"Basic {cred}"

    def clear_auth(self):
        self._auth_headers.clear()

    def request(self, method, url, **kwargs):
        headers = {**self._auth_headers, **kwargs.pop("headers", {})}
        return super().request(method, url, headers=headers, **kwargs)

    @contextmanager
    def ws_connect(self, url, *, headers=None, subprotocols=None):
        kw = {}
        if headers: kw["headers"] = headers
        if subprotocols: kw["subprotocols"] = subprotocols
        with self.websocket_connect(url, **kw) as ws:
            yield ws

    def assert_status(self, method, url, expected, **kwargs):
        r = self.request(method, url, **kwargs)
        assert r.status_code == expected, f"Expected {expected}, got {r.status_code}: {r.text[:200]}"
        return r

    def get(self, url, **kw): return self.request("GET", url, **kw)
    def post(self, url, **kw): return self.request("POST", url, **kw)
    def put(self, url, **kw): return self.request("PUT", url, **kw)
    def delete(self, url, **kw): return self.request("DELETE", url, **kw)


# === Tests ===
import pytest
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer

def make_app():
    app = FastAPI()
    sec = HTTPBearer(auto_error=False)
    @app.get("/public")
    async def pub(): return {"msg": "public"}
    @app.get("/protected")
    async def prot(c=Depends(sec)):
        if not c: raise HTTPException(401)
        return {"user": c.credentials}
    return app

def test_bearer_auth():
    c = FastAPITestClient(make_app())
    c.authenticate("tok123")
    assert c.get("/protected").status_code == 200

def test_clear_auth():
    c = FastAPITestClient(make_app())
    c.authenticate("tok"); c.clear_auth()
    assert len(c._auth_headers) == 0

def test_assert_status_ok():
    c = FastAPITestClient(make_app())
    r = c.assert_status("GET", "/public", 200)
    assert r.json()["msg"] == "public"

def test_assert_status_fail():
    c = FastAPITestClient(make_app())
    with pytest.raises(AssertionError): c.assert_status("GET", "/nope", 200)

def test_ws_connect():
    app = FastAPI()
    @app.websocket_route("/ws")
    async def ws(websocket):
        await websocket.accept()
        await websocket.send_json({"hi": True})
        await websocket.close()
    c = FastAPITestClient(app)
    with c.ws_connect("/ws") as ws:
        assert ws.receive_json() == {"hi": True}
