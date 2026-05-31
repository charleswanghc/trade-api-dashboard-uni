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
                stats = _sync_history(api, actno)
                logger.info("Startup history sync stats: %s", stats)

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


def _orderstatus_to_db_status(orderstatus: Optional[str]) -> str:
    """將交易所回傳的 orderstatus 對應成 DB 使用的 status 字串。"""
    if not orderstatus:
        return "submitted"
    s = orderstatus
    if any(k in s for k in ("全部成交", "已成交", "成交")):
        return "filled"
    if "部分成交" in s:
        return "partial_filled"
    if any(k in s for k in ("刪除", "取消", "撤單")):
        return "cancelled"
    if any(k in s for k in ("失敗", "拒絕", "保證金", "不足", "錯誤")):
        return "failed"
    return "submitted"


def _sync_history(api: Unitrade, actno: str) -> dict:
    """向交易所查詢當日歷史委託與成交，upsert 進資料庫。

    - query_reply → 有舊記錄就更新，沒有就新建 OrderHistory（包含非本系統下的單）
    - query_match → 以 network_id 去重，新成交記錄補建 TradeRecord
    回傳同步統計 dict。
    """
    from database import SessionLocal
    from models import OrderHistory, TradeRecord

    logger.info("Starting history sync for actno=%s", actno)
    db = SessionLocal()
    stats = {"reply_updated": 0, "reply_created": 0, "match_inserted": 0,
             "reply_error": None, "match_error": None}
    try:
        # ── 歷史委託回報 (query_reply) ────────────────────────────
        reply_resp = api.dtrade.query_reply(actno, 500, "", "", "", "")
        if reply_resp and getattr(reply_resp, "ok", False):
            for reply in (reply_resp.data or []):
                seq = (getattr(reply, "seq", None) or "").strip()
                if not seq:
                    continue

                orderstatus = getattr(reply, "orderstatus", None)
                ordno = getattr(reply, "orderno", None)
                filled_raw = getattr(reply, "matchqty", None)
                try:
                    filled = int(filled_raw) if filled_raw else None
                except (ValueError, TypeError):
                    filled = None

                order = db.query(OrderHistory).filter(OrderHistory.order_id == seq).first()
                if order:
                    # 更新已有記錄
                    order.fill_status = orderstatus
                    if ordno:
                        order.ordno = ordno
                    if filled is not None:
                        order.fill_quantity = filled
                    order.status = _orderstatus_to_db_status(orderstatus)
                    order.updated_at = datetime.utcnow()
                    stats["reply_updated"] += 1
                else:
                    # 新建記錄（非本系統下的單，例如透過其他工具下的）
                    productid = getattr(reply, "productid", None) or "UNKNOWN"
                    bs = getattr(reply, "bs", None) or "B"
                    qty_raw = getattr(reply, "orderqty", None)
                    try:
                        qty = int(qty_raw) if qty_raw else 0
                    except (ValueError, TypeError):
                        qty = 0
                    price_raw = getattr(reply, "orderprice", None)
                    try:
                        price = float(price_raw) if price_raw else None
                    except (ValueError, TypeError):
                        price = None

                    new_order = OrderHistory(
                        symbol=productid,
                        action=bs,
                        quantity=qty,
                        price=price,
                        account=getattr(reply, "investoracno", None) or actno,
                        sub_account=getattr(reply, "subact", None) or "",
                        order_id=seq,
                        ordno=ordno,
                        fill_status=orderstatus,
                        fill_quantity=filled,
                        status=_orderstatus_to_db_status(orderstatus),
                        source="sync",
                        updated_at=datetime.utcnow(),
                        note=getattr(reply, "note", None),
                    )
                    db.add(new_order)
                    stats["reply_created"] += 1

            db.commit()
            logger.info(
                "History sync reply: updated=%d created=%d",
                stats["reply_updated"], stats["reply_created"],
            )
        else:
            err = getattr(reply_resp, "error", "unknown") if reply_resp else "no response"
            stats["reply_error"] = err
            logger.warning("query_reply failed: %s", err)

        # ── 歷史成交回報 (query_match) ────────────────────────────
        match_resp = api.dtrade.query_match(actno, 500, "", "", "", "")
        if match_resp and getattr(match_resp, "ok", False):
            for match in (match_resp.data or []):
                orderno = getattr(match, "orderno", None)
                network_id = getattr(match, "networkid", None)

                # 以 network_id 去重
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

                # 嘗試關聯 OrderHistory（先用 ordno，找不到再用 seq）
                if orderno:
                    linked = db.query(OrderHistory).filter(
                        OrderHistory.ordno == orderno
                    ).first()
                    if linked:
                        trade.seq = linked.order_id
                        linked.fill_price = match_price
                        linked.fill_quantity = match_qty
                        linked.status = "filled"
                        linked.updated_at = datetime.utcnow()

                db.add(trade)
                stats["match_inserted"] += 1

            db.commit()
            logger.info("History sync match: inserted=%d", stats["match_inserted"])
        else:
            err = getattr(match_resp, "error", "unknown") if match_resp else "no response"
            stats["match_error"] = err
            logger.warning("query_match failed: %s", err)

    except Exception as exc:
        logger.error("History sync error: %s", exc)
        db.rollback()
        stats["exception"] = str(exc)
    finally:
        db.close()

    return stats


def trigger_history_sync() -> dict:
    """手動觸發歷史同步，供 /history-sync 端點呼叫。"""
    global _client
    if _client is None:
        return {"status": "error", "message": "Unitrade 尚未連線，請確認後端已成功登入"}

    actno = _get_env("UNITRADE_ACTNO", required=False)
    if not actno:
        return {"status": "error", "message": "未設定 UNITRADE_ACTNO 環境變數"}

    try:
        stats = _sync_history(_client, actno)
        if "exception" in stats:
            return {"status": "error", "message": stats["exception"]}
        msg = (
            f"同步完成：委託 {stats['reply_updated']} 筆更新 / "
            f"{stats['reply_created']} 筆新建；"
            f"成交 {stats['match_inserted']} 筆新建"
        )
        if stats.get("reply_error"):
            msg += f"（委託查詢錯誤：{stats['reply_error']}）"
        if stats.get("match_error"):
            msg += f"（成交查詢錯誤：{stats['match_error']}）"
        return {"status": "ok", "message": msg}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}