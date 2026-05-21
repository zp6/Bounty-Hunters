"""
Request-scoped dependency caching to reduce duplicate resolution. Fixes #795.
"""
from typing import Any, Callable, Dict, TypeVar, Optional
from functools import wraps
from fastapi import Request

T = TypeVar("T")

class RequestScopedCache:
    """Caches dependency results within a single request lifecycle."""
    
    _REQUEST_KEY = "_dependency_cache"
    
    @classmethod
    def get_cache(cls, request: Request) -> Dict[str, Any]:
        """Get or create the cache dict for this request."""
        if not hasattr(request.state, cls._REQUEST_KEY):
            setattr(request.state, cls._REQUEST_KEY, {})
        return getattr(request.state, cls._REQUEST_KEY)
    
    @classmethod
    def clear(cls, request: Request):
        """Clear the cache for this request."""
        if hasattr(request.state, cls._REQUEST_KEY):
            delattr(request.state, cls._REQUEST_KEY)


def cached_dependency(func: Optional[Callable] = None, *, key: Optional[str] = None):
    """
    Decorator that caches a FastAPI dependency result within the request scope.
    
    Usage:
        @cached_dependency
        async def get_db():
            return Database()
    """
    def decorator(fn: Callable) -> Callable:
        cache_key = key or f"{fn.__module__}.{fn.__qualname__}"
        
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            # Find request in args/kwargs
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if request is None:
                request = kwargs.get("request")
            
            if request is None:
                return await fn(*args, **kwargs) if asyncio.iscoroutinefunction(fn) else fn(*args, **kwargs)
            
            cache = RequestScopedCache.get_cache(request)
            if cache_key in cache:
                return cache[cache_key]
            
            result = await fn(*args, **kwargs) if asyncio.iscoroutinefunction(fn) else fn(*args, **kwargs)
            cache[cache_key] = result
            return result
        
        return wrapper
    
    if func is not None:
        return decorator(func)
    return decorator


import asyncio

# Tests
import pytest
from unittest.mock import MagicMock

def test_cache_creates_dict():
    req = MagicMock()
    req.state = MagicMock()
    cache = RequestScopedCache.get_cache(req)
    assert isinstance(cache, dict)

def test_clear_removes_cache():
    req = MagicMock()
    req.state = MagicMock()
    RequestScopedCache.get_cache(req)
    RequestScopedCache.clear(req)
    assert not hasattr(req.state, RequestScopedCache._REQUEST_KEY)

@pytest.mark.asyncio
async def test_cached_result_returned():
    call_count = 0
    @cached_dependency(key="test_dep")
    async def dep(request):
        nonlocal call_count
        call_count += 1
        return "result"
    
    req = MagicMock(); req.state = MagicMock()
    r1 = await dep(request=req)
    r2 = await dep(request=req)
    assert r1 == r2 == "result"
    assert call_count == 1  # Only called once

@pytest.mark.asyncio
async def test_different_requests_different_caches():
    @cached_dependency
    async def dep(request):
        return id(request)
    
    req1 = MagicMock(); req1.state = MagicMock()
    req2 = MagicMock(); req2.state = MagicMock()
    r1 = await dep(request=req1)
    r2 = await dep(request=req2)
    assert r1 != r2
