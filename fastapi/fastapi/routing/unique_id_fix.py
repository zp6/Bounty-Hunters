"""
Fix generate_unique_id producing duplicate operation IDs across routes. Fixes #764.
"""
from typing import Dict, Set
from fastapi.routing import APIRoute


class UniqueOperationIdGenerator:
    """Ensures unique operation IDs across all routes."""
    
    def __init__(self):
        self._used_ids: Set[str] = set()
        self._counter: Dict[str, int] = {}
    
    def generate_unique_id(self, route: APIRoute) -> str:
        """Generate a unique operation ID for a route, avoiding collisions."""
        base_id = self._generate_base_id(route)
        
        if base_id not in self._used_ids:
            self._used_ids.add(base_id)
            return base_id
        
        # Collision detected - add numeric suffix
        if base_id not in self._counter:
            self._counter[base_id] = 1
        self._counter[base_id] += 1
        unique_id = f"{base_id}_{self._counter[base_id]}"
        
        while unique_id in self._used_ids:
            self._counter[base_id] += 1
            unique_id = f"{base_id}_{self._counter[base_id]}"
        
        self._used_ids.add(unique_id)
        return unique_id
    
    def _generate_base_id(self, route: APIRoute) -> str:
        """Generate base operation ID from route method and path."""
        method = route.methods[0].lower() if route.methods else "get"
        path = route.path.strip("/").replace("/", "_").replace("{", "").replace("}", "")
        if not path:
            path = "root"
        return f"{method}_{path}"
    
    def reset(self):
        self._used_ids.clear()
        self._counter.clear()


# Tests
import pytest

def test_no_collision():
    from unittest.mock import MagicMock
    gen = UniqueOperationIdGenerator()
    r1 = MagicMock(spec=APIRoute); r1.methods = ["GET"]; r1.path = "/users"
    r2 = MagicMock(spec=APIRoute); r2.methods = ["GET"]; r2.path = "/users"
    id1 = gen.generate_unique_id(r1)
    id2 = gen.generate_unique_id(r2)
    assert id1 != id2
    assert id1 == "get_users"
    assert id2 == "get_users_2"

def test_different_paths():
    gen = UniqueOperationIdGenerator()
    r1 = MagicMock(spec=APIRoute); r1.methods = ["GET"]; r1.path = "/users"
    r2 = MagicMock(spec=APIRoute); r2.methods = ["POST"]; r2.path = "/users"
    id1 = gen.generate_unique_id(r1)
    id2 = gen.generate_unique_id(r2)
    assert id1 != id2

def test_reset():
    gen = UniqueOperationIdGenerator()
    r = MagicMock(spec=APIRoute); r.methods = ["GET"]; r.path = "/test"
    gen.generate_unique_id(r)
    gen.reset()
    assert len(gen._used_ids) == 0

def test_root_path():
    gen = UniqueOperationIdGenerator()
    r = MagicMock(spec=APIRoute); r.methods = ["GET"]; r.path = "/"
    id = gen.generate_unique_id(r)
    assert id == "get_root"
