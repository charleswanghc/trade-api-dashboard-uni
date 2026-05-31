import json
import logging
import os
import threading
from datetime import datetime
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
            _setup_order_callbacks(api)
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


def _setup_order_callbacks(api: Unitrade) -> None:
    """Register on_reply and on_match callbacks to persist exchange reports to DB.

    on_reply  → 委託回報（包含被交易所拒絕如保證金不足）→ 更新 OrderHistory
    on_match  → 成交回報 → 建立 TradeRecord 並更新 OrderHistory
    """
    from database import SessionLocal
    from models import OrderHistory, TradeRecord

    def on_reply(reply) -> None:
        """DOrderReply: orderstatus, statuscode, seq, orderno, matchqty ..."""
        db = SessionLocal()
        try:
            seq = (getattr(reply, "seq", None) or "").strip()
            if not seq:
                return
            order = db.query(OrderHistory).filter(OrderHistory.order_id == seq).first()
            if order:
                order.fill_status = getattr(reply, "orderstatus", None)
                order.ordno = getattr(reply, "orderno", None)
                filled = getattr(reply, "matchqty", None)
                if filled is not None:
                    try:
                        order.fill_quantity = int(filled)
                    except (ValueError, TypeError):
                        pass
                order.updated_at = datetime.utcnow()
                db.commit()
                logger.info(
                    "on_reply: seq=%s orderstatus=%s",
                    seq, getattr(reply, "orderstatus", ""),
                )
        except Exception as exc:
            logger.error("on_reply callback error: %s", exc)
            db.rollback()
        finally:
            db.close()

    def on_match(match) -> None:
        """DMatchReply: productid, bs, matchprice, matchqty, orderno ..."""
        db = SessionLocal()
        try:
            orderno = getattr(match, "orderno", None)
            match_price_raw = getattr(match, "matchprice", None)
            match_qty_raw = getattr(match, "matchqty", None)

            match_price = float(match_price_raw) if match_price_raw else None
            match_qty = int(match_qty_raw) if match_qty_raw else None

            # 建立成交記錄
            trade = TradeRecord(
                network_id=getattr(match, "networkid", None),
                orderno=orderno,
                account=getattr(match, "investoracno", None),
                sub_account=getattr(match, "subact", None),
                product_kind=getattr(match, "productkind", None),
                product_id=getattr(match, "productid", None),
                bs=getattr(match, "bs", None),
                match_price=match_price,
                match_qty=match_qty,
                match_seq=getattr(match, "matchseq", None),
                match_time=getattr(match, "matchtime", None),
                note=getattr(match, "note", None),
                mdate=getattr(match, "mdate", None),
            )

            # 嘗試關聯 OrderHistory
            if orderno:
                order = db.query(OrderHistory).filter(OrderHistory.ordno == orderno).first()
                if order:
                    trade.seq = order.order_id
                    order.fill_price = match_price
                    order.fill_quantity = match_qty
                    order.status = "filled"
                    order.updated_at = datetime.utcnow()

            db.add(trade)
            db.commit()
            logger.info(
                "on_match: orderno=%s product=%s bs=%s price=%s qty=%s",
                orderno,
                getattr(match, "productid", ""),
                getattr(match, "bs", ""),
                match_price,
                match_qty,
            )
        except Exception as exc:
            logger.error("on_match callback error: %s", exc)
            db.rollback()
        finally:
            db.close()

    api.dtrade.on_reply = on_reply
    api.dtrade.on_match = on_match
    logger.info("Unitrade order callbacks (on_reply / on_match) registered")