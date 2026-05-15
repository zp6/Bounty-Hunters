"""
OAuth2 token refresh support. Fixes #758
"""
from typing import Optional
from fastapi.security.oauth2 import OAuth2PasswordBearer


class OAuth2PasswordBearerWithRefresh(OAuth2PasswordBearer):
    """Drop-in replacement with refresh_url support."""
    def __init__(self, tokenUrl: str, refreshUrl: Optional[str] = None,
                 scheme_name: Optional[str] = None, scopes: Optional[dict] = None, auto_error: bool = True):
        super().__init__(tokenUrl=tokenUrl, scheme_name=scheme_name, scopes=scopes, auto_error=auto_error)
        self.refresh_url = refreshUrl


class OAuth2RefreshRequestForm:
    """Form for OAuth2 refresh token requests. grant_type must be refresh_token."""
    def __init__(self, grant_type: str = "refresh_token", refresh_token: str = "", scope: str = ""):
        if grant_type != "refresh_token":
            raise ValueError(f"grant_type must be 'refresh_token', got '{grant_type}'")
        self.grant_type = grant_type
        self.refresh_token = refresh_token
        self.scopes = scope.split() if scope else []


# === Tests ===
import pytest

def test_extends_base():
    auth = OAuth2PasswordBearerWithRefresh(tokenUrl="/token", refreshUrl="/refresh")
    assert auth.tokenUrl == "/token" and auth.refresh_url == "/refresh"

def test_no_refresh_url():
    auth = OAuth2PasswordBearerWithRefresh(tokenUrl="/token")
    assert auth.refresh_url is None

def test_valid_form():
    f = OAuth2RefreshRequestForm(refresh_token="abc")
    assert f.grant_type == "refresh_token" and f.refresh_token == "abc"

def test_invalid_grant():
    with pytest.raises(ValueError): OAuth2RefreshRequestForm(grant_type="password")

def test_scopes():
    f = OAuth2RefreshRequestForm(refresh_token="x", scope="read write")
    assert f.scopes == ["read", "write"]

def test_empty_scope():
    assert OAuth2RefreshRequestForm(refresh_token="x").scopes == []
