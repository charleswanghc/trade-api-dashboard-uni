import json
import logging
import os
import threading
from typing import Any, Optional

from unitrade.unitrade import Unitrade

logger = logging.getLogger(__name__)


class UnitradeLoginError(RuntimeError):
    pass


class UnitradeOrderError(RuntimeError):
    pass


_client_lock = threading.Lock()
_client: Optional[Unitrade] = None


def _get_env(name: str, required: bool = True) -> Optional[str]:
    value = os.getenv(name)
    if required and not value:
        raise UnitradeLoginError(f"Missing environment variable: {name}")
    return value


def get_unitrade_client() -> Unitrade:
    """Get a logged-in Unitrade client (singleton)."""
    global _client
    if _client is not None:
        return _client

    with _client_lock:
        if _client is not None:
            return _client

        ws_url = _get_env("UNITRADE_WS_URL")
        account = _get_env("UNITRADE_ACCOUNT")
        password = _get_env("UNITRADE_PASSWORD")
        cert_file = _get_env("UNITRADE_CERT_FILE")
        cert_password = _get_env("UNITRADE_CERT_PASSWORD")

        try:
            api = Unitrade()
            api.login(ws_url, account, password, cert_file, cert_password)
            _client = api
            logger.info("Unitrade login succeeded")
            return api
        except Exception as exc:  # Unitrade SDK raises generic exceptions
            logger.exception("Unitrade login failed: %s", exc)
            raise UnitradeLoginError(str(exc)) from exc


def serialize_order_result(result: Any) -> str:
    """Serialize Unitrade order result into a JSON string."""
    if result is None:
        return "{}"

    if isinstance(result, (str, int, float, bool)):
        return json.dumps({"value": result}, ensure_ascii=False)

    if isinstance(result, dict):
        return json.dumps(result, ensure_ascii=False, default=str)

    try:
        return json.dumps(result.__dict__, ensure_ascii=False, default=str)
    except Exception:
        return json.dumps({"value": str(result)}, ensure_ascii=False)


def extract_order_id(result: Any) -> Optional[str]:
    """Best-effort extraction of order_id from Unitrade response."""
    if result is None:
        return None

    if isinstance(result, dict):
        return (
            result.get("order_id")
            or result.get("orderId")
            or result.get("id")
        )

    for attr in ("order_id", "orderId", "id"):
        if hasattr(result, attr):
            value = getattr(result, attr)
            if value:
                return str(value)
    return None