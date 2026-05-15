"""
Enhanced OpenAPI schema generation with server, contact, and license info.
Fixes #801
"""
from typing import Any, Dict, List, Optional
from fastapi.openapi.utils import get_openapi


def get_openapi_with_metadata(
    title: str, version: str = "1.0.0", description: Optional[str] = None,
    routes: Optional[list] = None, servers: Optional[List[Dict[str, str]]] = None,
    contact: Optional[Dict[str, str]] = None, license_info: Optional[Dict[str, str]] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    schema = get_openapi(title=title, version=version, description=description, routes=routes, **kwargs)
    if servers is not None:
        valid = [{"url": s["url"], "description": s.get("description", "")} for s in servers if isinstance(s, dict) and "url" in s]
        if valid:
            schema["servers"] = valid
    if contact is not None:
        schema.setdefault("info", {})
        entry = {k: contact[k] for k in ("name", "url", "email") if k in contact}
        if entry:
            schema["info"]["contact"] = entry
    if license_info is not None:
        schema.setdefault("info", {})
        entry = {k: license_info[k] for k in ("name", "url") if k in license_info}
        if entry:
            schema["info"]["license"] = entry
    return schema


# === Tests ===
import pytest

def test_servers():
    s = get_openapi_with_metadata(title="T", version="1.0.0", servers=[{"url": "https://api.example.com", "description": "Prod"}])
    assert "servers" in s and s["servers"][0]["url"] == "https://api.example.com"

def test_contact():
    s = get_openapi_with_metadata(title="T", version="1.0.0", contact={"name": "Dev", "email": "dev@example.com"})
    assert s["info"]["contact"]["name"] == "Dev"

def test_license():
    s = get_openapi_with_metadata(title="T", version="1.0.0", license_info={"name": "MIT", "url": "https://opensource.org/licenses/MIT"})
    assert s["info"]["license"]["name"] == "MIT"

def test_no_params_unchanged():
    s = get_openapi_with_metadata(title="T", version="1.0.0")
    assert "servers" not in s

def test_all_combined():
    s = get_openapi_with_metadata(title="T", version="2.0.0", servers=[{"url": "https://api.test.com"}],
        contact={"name": "Test"}, license_info={"name": "Apache-2.0"})
    assert s["servers"][0]["url"] == "https://api.test.com"
    assert s["info"]["contact"]["name"] == "Test"
    assert s["info"]["license"]["name"] == "Apache-2.0"
