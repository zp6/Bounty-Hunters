"""
Patch for fastapi/openapi/utils.py to support servers, contact, and license info.
This file should be merged into fastapi/openapi/utils.py.
"""

# The following changes should be applied to the get_openapi function:

from typing import Any, Dict, List, Optional, Sequence


def get_openapi(
    *,
    title: str,
    version: str = "0.1.0",
    openapi_version: str = "3.1.0",
    summary: Optional[str] = None,
    description: Optional[str] = None,
    routes: Sequence[Any] = ...,
    # NEW PARAMETERS
    servers: Optional[List[Dict[str, Any]]] = None,
    contact: Optional[Dict[str, str]] = None,
    license_info: Optional[Dict[str, str]] = None,
    webhook: Optional[Any] = None,
    tags: Optional[List[Dict[str, Any]]] = None,
    # ... existing parameters
) -> Dict[str, Any]:
    """Generate OpenAPI schema with server, contact, and license information.

    Args:
        servers: List of server dicts with 'url' and 'description' fields.
            Example: [{"url": "https://api.example.com", "description": "Production"}]
        contact: Contact dict with 'name', 'url', and 'email' fields.
            Example: {"name": "API Support", "email": "support@example.com"}
        license_info: License dict with 'name' and 'url' fields.
            Example: {"name": "MIT", "url": "https://opensource.org/licenses/MIT"}
    """
    output = {
        "openapi": openapi_version,
        "info": {
            "title": title,
            "version": version,
        },
    }

    if summary:
        output["info"]["summary"] = summary
    if description:
        output["info"]["description"] = description

    # Add contact information if provided
    if contact:
        output["info"]["contact"] = contact

    # Add license information if provided
    if license_info:
        output["info"]["license"] = license_info

    # Add servers if provided
    if servers:
        output["servers"] = servers

    # ... rest of existing function logic
    return output
