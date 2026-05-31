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

            # 依官方文件：先掛 callbacks，再執行 login
            # 確保連線事件與委託回報在登入過程中不會被漏掉
            _setup_order_callbacks(api)

            api.login(ws_url, account, password, cert_file, cert_password)
            _client = api
            logger.info("Unitrade login succeeded")

            # 登入後同步當日歷史委託/成交（補回程式重啟前的紀錄）
            actno = _get_env("UNITRADE_ACTNO", required=False)
            if actno:
                _sync_history(api, actno)

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
    """Register all callbacks per Unitrade documentation.

    官方指引：在 login() **之前**先完成所有 callback 的掛載，確保：
    - on_error        : API 層級錯誤通知
    - on_connected    : dtrade 連線成功（含斷線重連）
    - on_disconnected : dtrade 斷線通知
    - on_reply        : 委託回報（含交易所拒絕，如保證金不足）→ 更新 OrderHistory
    - on_match        : 成交回報 → 建立 TradeRecord 並更新 OrderHistory
    """
    from database import SessionLocal
    from models import OrderHistory, TradeRecord

    # ── 全域錯誤事件 ──────────────────────────────────────────────
    def on_error(err) -> None:
        logger.error("Unitrade API error: %s", err)

    api.on_error = on_error

    # ── dtrade 連線事件 ───────────────────────────────────────────
    def dtrade_on_connected() -> None:
        server = api.dtrade.get_current_server()
        logger.info("dtrade connected: %s", server)

    def dtrade_on_disconnected() -> None:
        server = api.dtrade.get_current_server()
        logger.warning("dtrade disconnected: %s", server)

    api.dtrade.on_connected = dtrade_on_connected
    api.dtrade.on_disconnected = dtrade_on_disconnected

    # ── 委託回報 (on_reply) ───────────────────────────────────────
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

    # ── 成交回報 (on_match) ───────────────────────────────────────
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
    logger.info("Unitrade callbacks registered (on_error / on_connected / on_disconnected / on_reply / on_match)")


def _sync_history(api: Unitrade, actno: str) -> None:
    """登入後向交易所查詢當日歷史委託與成交，補回程式重啟期間遺漏的紀錄。

    對應 Unitrade 文件「委託查詢 query_reply」與「成交查詢 query_match」。
    """
    from database import SessionLocal
    from models import OrderHistory, TradeRecord

    logger.info("Starting history sync for actno=%s", actno)
    db = SessionLocal()
    try:
        # ── 歷史委託回報 ──────────────────────────────────────────
        reply_resp = api.dtrade.query_reply(actno, 500, "", "", "", "")
        if reply_resp and getattr(reply_resp, "ok", False):
            for reply in (reply_resp.data or []):
                seq = (getattr(reply, "seq", None) or "").strip()
                if not seq:
                    continue
                order = db.query(OrderHistory).filter(OrderHistory.order_id == seq).first()
                if order:
                    order.fill_status = getattr(reply, "orderstatus", None)
                    ordno = getattr(reply, "orderno", None)
                    if ordno:
                        order.ordno = ordno
                    filled = getattr(reply, "matchqty", None)
                    if filled is not None:
                        try:
                            order.fill_quantity = int(filled)
                        except (ValueError, TypeError):
                            pass
                    order.updated_at = datetime.utcnow()
            db.commit()
            logger.info("History sync: applied %d order replies", len(reply_resp.data or []))
        else:
            err = getattr(reply_resp, "error", "unknown") if reply_resp else "no response"
            logger.warning("query_reply failed: %s", err)

        # ── 歷史成交回報 ──────────────────────────────────────────
        match_resp = api.dtrade.query_match(actno, 500, "", "", "", "")
        if match_resp and getattr(match_resp, "ok", False):
            new_count = 0
            for match in (match_resp.data or []):
                orderno = getattr(match, "orderno", None)
                network_id = getattr(match, "networkid", None)

                # 以 network_id 去重，避免重複插入
                if network_id:
                    exists = db.query(TradeRecord).filter(
                        TradeRecord.network_id == network_id
                    ).first()
                    if exists:
                        continue

                match_price_raw = getattr(match, "matchprice", None)
                match_qty_raw = getattr(match, "matchqty", None)
                match_price = float(match_price_raw) if match_price_raw else None
                match_qty = int(match_qty_raw) if match_qty_raw else None

                trade = TradeRecord(
                    network_id=network_id,
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
                new_count += 1

            db.commit()
            logger.info("History sync: inserted %d new trade records", new_count)
        else:
            err = getattr(match_resp, "error", "unknown") if match_resp else "no response"
            logger.warning("query_match failed: %s", err)

    except Exception as exc:
        logger.error("History sync error: %s", exc)
        db.rollback()
    finally:
        db.close()


def trigger_history_sync() -> dict:
    """手動觸發歷史同步，供 /history-sync 端點呼叫。"""
    global _client
    if _client is None:
        return {"status": "error", "message": "Unitrade 尚未連線"}

    actno = _get_env("UNITRADE_ACTNO", required=False)
    if not actno:
        return {"status": "error", "message": "未設定 UNITRADE_ACTNO"}

    try:
        _sync_history(_client, actno)
        return {"status": "ok", "message": f"歷史同步完成 (actno={actno})"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}