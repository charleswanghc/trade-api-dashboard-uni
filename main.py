import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, date, timedelta
from typing import Literal, Optional, List

import httpx

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from database import get_db
from models import OrderHistory, StrategyConfig, SignalHistory, SignalType, TradeRecord

from unitrade.trade.ddata import DOrderObject

from unitrade_client import (
    UnitradeLoginError,
    extract_order_id,
    get_unitrade_client,
    serialize_order_result,
    trigger_history_sync,
)

logger = logging.getLogger(__name__)

# ==================== Pydantic Models ====================

class OrderRequest(BaseModel):
    actno: Optional[str] = None
    subactno: Optional[str] = ""
    productid: str
    bs: Literal["B", "S"]
    ordertype: Literal["L", "M", "P"] = "L"
    price: float = 0
    orderqty: int = Field(..., gt=0)
    ordercondition: Literal["I", "R", "F"] = "R"
    opencloseflag: Optional[Literal["0", "1", ""]] = ""
    dtrade: Optional[Literal["Y", "N"]] = "N"
    note: Optional[str] = ""
    strategy: Optional[str] = None

    @model_validator(mode="after")
    def normalize(self):
        if self.ordertype in ("M", "P"):
            self.price = 0
        if self.ordertype == "L" and self.price <= 0:
            raise ValueError("限價單需提供 price")
        if self.note and len(self.note) > 10:
            raise ValueError("note 長度需小於等於 10")
        return self


class OrderResponse(BaseModel):
    status: str
    order_id: Optional[str] = None
    result: Optional[dict] = None


class SignalRequest(BaseModel):
    """簡化版訊號請求 - TradingView 只需傳送訊號即可"""
    strategy: str = Field(..., description="策略名稱")
    signal: Literal["long_entry", "long_exit", "short_entry", "short_exit"] = Field(..., description="訊號類型")
    quantity: int = Field(default=1, gt=0, description="訊號數量（會乘以倍數）")
    price: Optional[float] = Field(default=None, description="訊號價格（選填）")
    product: Optional[str] = Field(default=None, description="訊號商品（選填，若未提供則使用策略設定）")
    note: Optional[str] = Field(default=None, max_length=10, description="備註")


class SimpleSignalRequest(BaseModel):
    """極簡訊號請求 - 適用於 TradingView 佔位符"""
    strategy: str = Field(..., description="策略名稱")
    action: Literal["entry", "exit"] = Field(..., description="動作：進場或出場")
    side: Literal["buy", "sell"] = Field(..., description="方向：買入或賣出")
    quantity: int = Field(default=1, gt=0, description="訊號數量")
    price: Optional[float] = Field(default=None, description="進場/出場價格")
    stop_loss: Optional[float] = Field(default=None, description="止損價格")
    take_profit: Optional[float] = Field(default=None, description="止盈價格")
    note: Optional[str] = Field(default=None, max_length=10, description="備註")


class SignalResponse(BaseModel):
    status: str
    signal_id: Optional[int] = None
    order_id: Optional[str] = None
    message: Optional[str] = None
    actual_product: Optional[str] = None
    actual_quantity: Optional[int] = None


class StrategyConfigRequest(BaseModel):
    strategy_name: str = Field(..., max_length=50)
    source_product: str = Field(..., max_length=20)
    target_product: str = Field(..., max_length=20)
    quantity_multiplier: int = Field(default=1, gt=0)
    max_position: int = Field(default=10, gt=0)
    order_type: Literal["L", "M", "P"] = "L"
    order_condition: Literal["I", "R", "F"] = "R"
    dtrade: Literal["Y", "N"] = "N"
    entry_order_type: Literal["L", "M", "P"] = "L"
    entry_order_condition: Literal["I", "R", "F"] = "R"
    exit_order_type: Literal["L", "M", "P"] = "M"
    exit_order_condition: Literal["I", "R", "F"] = "I"
    account: Optional[str] = None
    sub_account: str = ""
    enabled: bool = True
    auto_rollover: bool = False
    description: Optional[str] = None


# ==================== FastAPI App ====================

_scheduler = AsyncIOScheduler(timezone="Asia/Taipei")


def _scheduled_sync_job(label: str) -> None:
    """排程觸發的歷史同步作業（同步執行，在 scheduler 執行緒中呼叫）。"""
    logger.info("[排程同步] 觸發點: %s", label)
    result = trigger_history_sync()
    logger.info("[排程同步] 結果: %s", result)


@asynccontextmanager
async def lifespan(app_instance):
    # ── 啟動 ─────────────────────────────────────────────────────
    from models import Base
    from database import engine
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")

    # 台灣期貨換日時間表（Asia/Taipei）：
    #   凌晨場結束：每日 05:00 → 排程 04:50 同步，確保夜盤資料不遺漏
    #   日盤收盤後：每日 14:00 → 排程 13:55 同步，保存日盤完整紀錄
    _scheduler.add_job(
        _scheduled_sync_job,
        CronTrigger(hour=4, minute=50, timezone="Asia/Taipei"),
        args=["換日前(04:50)"],
        id="sync_before_rollover",
        replace_existing=True,
    )
    _scheduler.add_job(
        _scheduled_sync_job,
        CronTrigger(hour=13, minute=55, timezone="Asia/Taipei"),
        args=["日盤收盤後(13:55)"],
        id="sync_after_day_close",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("APScheduler started — 自動同步排程：04:50 / 13:55 (Asia/Taipei)")

    yield

    # ── 關閉 ─────────────────────────────────────────────────────
    _scheduler.shutdown(wait=False)
    logger.info("APScheduler stopped")


cors_origins = os.getenv("CORS_ORIGINS", "*")

app = FastAPI(lifespan=lifespan)

origins = [o.strip() for o in cors_origins.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== 商品查詢轟助函式 ====================
def get_taifex_front_month_contract(base_code: str) -> str:
    """計算台灣期交所近月合約代碼。

    月份代碼：A=1月, B=2月, C=3月, D=4月, E=5月, F=6月,
                G=7月, H=8月, I=9月, J=10月, K=11月, L=12月
    到期日：每月第三個週三。
    
    範例：get_taifex_front_month_contract('MXF') -> 'MXFF6'  (若目前是2026年6月)
    """
    today = date.today()

    def third_wednesday(year: int, month: int) -> date:
        d = date(year, month, 1)
        days_until_wed = (2 - d.weekday()) % 7  # 0=Mon, 2=Wed
        first_wed = d + timedelta(days=days_until_wed)
        return first_wed + timedelta(weeks=2)

    expiry = third_wednesday(today.year, today.month)

    if today > expiry:
        if today.month == 12:
            contract_year, contract_month = today.year + 1, 1
        else:
            contract_year, contract_month = today.year, today.month + 1
    else:
        contract_year, contract_month = today.year, today.month

    # A=Jan(印碼65), B=Feb, ..., L=Dec(印碼76)
    month_code = chr(ord('A') + contract_month - 1)
    year_code = str(contract_year)[-1]
    return f"{base_code}{month_code}{year_code}"

def _parse_margin_html(html_text: str) -> list:
    """Parse pfctrade margin HTML table into list of dicts."""
    from html.parser import HTMLParser

    class _TblParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.rows = []
            self._row = None
            self._cell = None

        def handle_starttag(self, tag, attrs):
            if tag == "tr":
                self._row = []
            elif tag in ("td", "th") and self._row is not None:
                self._cell = ""

        def handle_endtag(self, tag):
            if tag in ("td", "th") and self._cell is not None:
                self._row.append(self._cell.strip())
                self._cell = None
            elif tag == "tr" and self._row is not None:
                if any(c for c in self._row):
                    self.rows.append(self._row)
                self._row = None

        def handle_data(self, data):
            if self._cell is not None:
                self._cell += data

    parser = _TblParser()
    parser.feed(html_text)
    if len(parser.rows) < 2:
        return []
    HEADER_MAP = {
        "交易所": "exchange",
        "商品代號": "code",
        "商品名稱": "name",
        "原始保證金": "original_margin",
        "維持保證金": "maintenance_margin",
        "幣別": "currency",
    }
    headers = [HEADER_MAP.get(h, h) for h in parser.rows[0]]
    return [
        {headers[i]: row[i] for i in range(len(headers))}
        for row in parser.rows[1:]
        if len(row) >= len(headers)
    ]


# ==================== Health Check ====================

@app.get("/health")
def health_check():
    """Quick health check - does not test Unitrade connection to avoid timeout"""
    return {
        "status": "ok",
        "service": "trade-api",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/health/db")
def db_health_check(db: Session = Depends(get_db)):
    """Check database connectivity"""
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        return {"status": "error", "database": "disconnected", "error": str(exc)}


@app.get("/health/unitrade")
def unitrade_health_check():
    """Check Unitrade API connection (may be slow on first call)"""
    try:
        _ = get_unitrade_client()
        return {"status": "ok", "unitrade": "connected"}
    except Exception as exc:
        return {"status": "error", "unitrade": "disconnected", "error": str(exc)}


# ==================== 下單核心函式 ====================

def submit_unitrade_order(
    payload: OrderRequest,
    db: Session,
    source: str,
) -> OrderResponse:
    logger.info(
        "Order request received: source=%s productid=%s bs=%s qty=%s",
        source, payload.productid, payload.bs, payload.orderqty,
    )
    actno = payload.actno or os.getenv("UNITRADE_ACTNO")
    if not actno:
        raise HTTPException(status_code=400, detail="缺少 actno (帳號)")

    order_record = OrderHistory(
        symbol=payload.productid,
        action=payload.bs,
        quantity=payload.orderqty,
        price=payload.price,
        strategy=payload.strategy,
        order_type=payload.ordertype,
        order_condition=payload.ordercondition,
        open_close_flag=payload.opencloseflag,
        dtrade=payload.dtrade,
        note=payload.note,
        account=actno,
        sub_account=payload.subactno,
        source=source,
        status="pending",
    )

    db.add(order_record)
    db.commit()
    db.refresh(order_record)

    try:
        api = get_unitrade_client()
        order_obj = DOrderObject(
            actno=actno,
            subactno=payload.subactno or "",
            productid=payload.productid,
            bs=payload.bs,
            ordertype=payload.ordertype,
            price=payload.price,
            orderqty=payload.orderqty,
            ordercondition=payload.ordercondition,
            opencloseflag=payload.opencloseflag or "",
            dtrade=payload.dtrade or "N",
            note=payload.note or "",
        )
        result = api.dtrade.order(order_obj)
    except UnitradeLoginError as exc:
        order_record.status = "failed"
        order_record.error_message = str(exc)
        order_record.updated_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        order_record.status = "failed"
        order_record.error_message = str(exc)
        order_record.updated_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # DOrderResponse: issend=False 表示本地端即拒絕（如帳號格式錯誤）
    issend = getattr(result, "issend", True)
    if not issend:
        err_msg = getattr(result, "errormsg", None) or getattr(result, "errorcode", "下單失敗")
        order_record.status = "failed"
        order_record.error_message = err_msg
        order_record.order_result = serialize_order_result(result)
        order_record.updated_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=400, detail=err_msg)

    # seq 可能帶有尾端空白，需 strip
    order_id = (getattr(result, "seq", None) or "").strip() or extract_order_id(result)
    order_record.order_id = order_id
    order_record.status = "submitted"
    order_record.order_result = serialize_order_result(result)
    order_record.updated_at = datetime.utcnow()
    db.commit()

    result_dict = None
    if isinstance(result, dict):
        result_dict = result

    return OrderResponse(status="ok", order_id=order_id, result=result_dict)


# ==================== Webhook & Order API ====================

@app.post("/webhook", response_model=OrderResponse)
def tradingview_webhook(
    payload: OrderRequest,
    db: Session = Depends(get_db),
):
    """TradingView Webhook 直接下單端點"""
    return submit_unitrade_order(payload, db, source="webhook")


@app.post("/order", response_model=OrderResponse)
def manual_order(
    payload: OrderRequest,
    db: Session = Depends(get_db),
):
    """手動下單端點"""
    return submit_unitrade_order(payload, db, source="manual")


@app.get("/orders")
def list_orders(
    db: Session = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    """列出訂單歷史"""
    orders = (
        db.query(OrderHistory)
        .order_by(OrderHistory.created_at.desc())
        .offset(offset)
        .limit(min(limit, 1000))
        .all()
    )
    return [o.to_dict() for o in orders]


# ==================== 訊號處理 API ====================

@app.post("/signal", response_model=SignalResponse)
def process_signal(
    signal: SignalRequest,
    db: Session = Depends(get_db),
):
    """
    處理 TradingView 訊號 - 根據策略設定自動轉換為實際訂單

    範例訊號：
    {
        "strategy": "TXF_vivi_mini",
        "signal": "long_entry",
        "quantity": 1,
        "price": 21500,
        "note": "Buy"
    }
    """
    logger.info(
        "Signal received: strategy=%s signal=%s qty=%s",
        signal.strategy, signal.signal, signal.quantity,
    )

    # 查詢策略設定
    strategy_config = db.query(StrategyConfig).filter(
        StrategyConfig.strategy_name == signal.strategy
    ).first()

    if not strategy_config:
        signal_record = SignalHistory(
            strategy_name=signal.strategy,
            signal_type=signal.signal,
            signal_product=signal.product,
            signal_quantity=signal.quantity,
            signal_price=signal.price,
            signal_note=signal.note,
            status="failed",
            error_message=f"Strategy '{signal.strategy}' not found",
            raw_payload=signal.model_dump(),
        )
        db.add(signal_record)
        db.commit()
        raise HTTPException(status_code=404, detail=f"未找到策略設定: {signal.strategy}")

    if not strategy_config.enabled:
        signal_record = SignalHistory(
            strategy_name=signal.strategy,
            signal_type=signal.signal,
            signal_product=signal.product,
            signal_quantity=signal.quantity,
            signal_price=signal.price,
            signal_note=signal.note,
            status="ignored",
            error_message="Strategy is disabled",
            raw_payload=signal.model_dump(),
        )
        db.add(signal_record)
        db.commit()
        return SignalResponse(
            status="ignored",
            message=f"策略 '{signal.strategy}' 已停用",
        )

    # 計算實際下單參數
    if strategy_config.auto_rollover:
        # 自動換月：target_product 為商品基底代碼（如 MXF），自動補上近月月份代碼
        actual_product = get_taifex_front_month_contract(strategy_config.target_product)
        logger.info("Auto rollover: base=%s → contract=%s", strategy_config.target_product, actual_product)
    else:
        actual_product = strategy_config.target_product
    actual_quantity = signal.quantity * strategy_config.quantity_multiplier

    # 判斷買賣方向
    if signal.signal in ("long_entry", "short_exit"):
        actual_bs = "B"
    else:  # long_exit, short_entry
        actual_bs = "S"

    # 判斷是進場還是出場
    is_entry = signal.signal in ("long_entry", "short_entry")

    # 選擇對應的訂單類型和條件
    if is_entry:
        order_type = strategy_config.entry_order_type
        order_condition = strategy_config.entry_order_condition
        open_close_flag = ""  # 進場
    else:
        order_type = strategy_config.exit_order_type
        order_condition = strategy_config.exit_order_condition
        open_close_flag = "1"  # 出場

    # 處理價格
    if order_type == "L" and signal.price:
        actual_price = signal.price
    else:
        actual_price = 0  # 市價單

    # 建立訂單請求
    order_payload = OrderRequest(
        actno=strategy_config.account,
        subactno=strategy_config.sub_account or "",
        productid=actual_product,
        bs=actual_bs,
        ordertype=order_type,
        price=actual_price,
        orderqty=actual_quantity,
        ordercondition=order_condition,
        opencloseflag=open_close_flag,
        dtrade=strategy_config.dtrade or "N",
        note=signal.note or signal.signal,
        strategy=signal.strategy,
    )

    # 記錄訊號
    signal_record = SignalHistory(
        strategy_name=signal.strategy,
        signal_type=signal.signal,
        signal_product=signal.product,
        signal_quantity=signal.quantity,
        signal_price=signal.price,
        signal_note=signal.note,
        actual_product=actual_product,
        actual_quantity=actual_quantity,
        actual_bs=actual_bs,
        status="processing",
        raw_payload=signal.model_dump(),
    )
    db.add(signal_record)
    db.commit()
    db.refresh(signal_record)

    # 提交訂單
    try:
        order_response = submit_unitrade_order(order_payload, db, source="signal")

        signal_record.status = "processed"
        signal_record.order_id = order_response.order_id
        db.commit()

        return SignalResponse(
            status="ok",
            signal_id=signal_record.id,
            order_id=order_response.order_id,
            message=f"訊號已處理：{actual_product} {actual_bs} {actual_quantity}口",
            actual_product=actual_product,
            actual_quantity=actual_quantity,
        )

    except Exception as exc:
        signal_record.status = "failed"
        signal_record.error_message = str(exc)
        db.commit()
        raise


@app.post("/signal/simple", response_model=SignalResponse)
def process_simple_signal(
    signal: SimpleSignalRequest,
    db: Session = Depends(get_db),
):
    """
    處理極簡訊號 - 適用於 TradingView Alert 佔位符

    範例訊號：
    {
        "strategy": "TXF_vivi_mini",
        "action": "entry",
        "side": "buy",
        "quantity": 1,
        "price": 21500,
        "stop_loss": 21400
    }
    """
    logger.info(
        "Simple signal received: strategy=%s action=%s side=%s qty=%s",
        signal.strategy, signal.action, signal.side, signal.quantity,
    )

    # 轉換為標準訊號格式
    if signal.action == "entry":
        signal_type = "long_entry" if signal.side == "buy" else "short_entry"
    else:  # exit
        signal_type = "long_exit" if signal.side == "sell" else "short_exit"

    standard_signal = SignalRequest(
        strategy=signal.strategy,
        signal=signal_type,
        quantity=signal.quantity,
        price=signal.price,
        note=signal.note or f"{signal.action}_{signal.side}",
    )

    return process_signal(standard_signal, db)


# ==================== 策略管理 API ====================

@app.get("/strategies", response_model=List[dict])
def list_strategies(
    db: Session = Depends(get_db),
    enabled_only: bool = False,
):
    """列出所有策略設定"""
    query = db.query(StrategyConfig)
    if enabled_only:
        query = query.filter(StrategyConfig.enabled == True)
    strategies = query.order_by(StrategyConfig.strategy_name).all()
    return [s.to_dict() for s in strategies]


@app.get("/strategies/{strategy_name}", response_model=dict)
def get_strategy(
    strategy_name: str,
    db: Session = Depends(get_db),
):
    """取得單一策略設定"""
    strategy = db.query(StrategyConfig).filter(
        StrategyConfig.strategy_name == strategy_name
    ).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="未找到策略")
    return strategy.to_dict()


@app.post("/strategies", response_model=dict)
def create_strategy(
    config: StrategyConfigRequest,
    db: Session = Depends(get_db),
):
    """建立新策略設定"""
    existing = db.query(StrategyConfig).filter(
        StrategyConfig.strategy_name == config.strategy_name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="策略名稱已存在")

    strategy = StrategyConfig(**config.model_dump())
    db.add(strategy)
    db.commit()
    db.refresh(strategy)
    logger.info("Strategy created: %s", config.strategy_name)
    return strategy.to_dict()


@app.put("/strategies/{strategy_name}", response_model=dict)
def update_strategy(
    strategy_name: str,
    config: StrategyConfigRequest,
    db: Session = Depends(get_db),
):
    """更新策略設定"""
    strategy = db.query(StrategyConfig).filter(
        StrategyConfig.strategy_name == strategy_name
    ).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="未找到策略")

    for key, value in config.model_dump().items():
        if key != "strategy_name":
            setattr(strategy, key, value)

    strategy.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(strategy)
    logger.info("Strategy updated: %s", strategy_name)
    return strategy.to_dict()


@app.delete("/strategies/{strategy_name}")
def delete_strategy(
    strategy_name: str,
    db: Session = Depends(get_db),
):
    """刪除策略設定"""
    strategy = db.query(StrategyConfig).filter(
        StrategyConfig.strategy_name == strategy_name
    ).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="未找到策略")

    db.delete(strategy)
    db.commit()
    logger.info("Strategy deleted: %s", strategy_name)
    return {"status": "ok", "message": f"已刪除策略: {strategy_name}"}


@app.patch("/strategies/{strategy_name}/toggle")
def toggle_strategy(
    strategy_name: str,
    db: Session = Depends(get_db),
):
    """啟用/停用策略"""
    strategy = db.query(StrategyConfig).filter(
        StrategyConfig.strategy_name == strategy_name
    ).first()
    if not strategy:
        raise HTTPException(status_code=404, detail="未找到策略")

    strategy.enabled = not strategy.enabled
    strategy.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(strategy)
    logger.info("Strategy toggled: %s enabled=%s", strategy_name, strategy.enabled)
    return strategy.to_dict()


# ==================== 訊號歷史 API ====================

@app.get("/signals")
def list_signals(
    db: Session = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
    strategy: Optional[str] = None,
):
    """列出訊號歷史"""
    query = db.query(SignalHistory).order_by(SignalHistory.created_at.desc())
    if strategy:
        query = query.filter(SignalHistory.strategy_name == strategy)
    signals = query.offset(offset).limit(min(limit, 1000)).all()
    return [s.to_dict() for s in signals]


@app.get("/signals/{signal_id}")
def get_signal(
    signal_id: int,
    db: Session = Depends(get_db),
):
    """取得單一訊號記錄"""
    signal = db.query(SignalHistory).filter(SignalHistory.id == signal_id).first()
    if not signal:
        raise HTTPException(status_code=404, detail="未找到訊號記錄")
    return signal.to_dict()


# ==================== Product Lookup Proxy ====================

@app.get("/product-lookup/tw")
async def product_lookup_tw():
    """代理查詢台灣期交所保證金表"""
    url = "https://messagebus.pfctrade.com:9998/futuremarginquery"
    try:
        async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            try:
                data = r.json()
                if isinstance(data, list):
                    return data
            except Exception:
                pass
            return _parse_margin_html(r.text)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="查詢逾時")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"查詢失敗: {str(e)}")


@app.get("/product-lookup/foreign")
async def product_lookup_foreign():
    """代理查詢海外期貨保證金表"""
    url = "https://messagebus.pfctrade.com:9998/foreignfuturemarginquery"
    try:
        async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            try:
                data = r.json()
                if isinstance(data, list):
                    return data
            except Exception:
                pass
            return _parse_margin_html(r.text)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="查詢逾時")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"查詢失敗: {str(e)}")


# ==================== 成交紀錄 API ====================

@app.get("/trades")
def list_trades(
    db: Session = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
    product_id: Optional[str] = None,
):
    """列出成交回報（來自 dtrade.on_match 推播）"""
    query = db.query(TradeRecord).order_by(TradeRecord.created_at.desc())
    if product_id:
        query = query.filter(TradeRecord.product_id == product_id)
    trades = query.offset(offset).limit(min(limit, 1000)).all()
    return [t.to_dict() for t in trades]


@app.get("/order-replies")
def list_order_replies(
    db: Session = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    """列出有交易所回報狀態的委託（fill_status 已被 on_reply 更新）"""
    orders = (
        db.query(OrderHistory)
        .filter(OrderHistory.fill_status.isnot(None))
        .order_by(OrderHistory.updated_at.desc())
        .offset(offset)
        .limit(min(limit, 1000))
        .all()
    )
    return [o.to_dict() for o in orders]


@app.post("/history-sync")
def history_sync():
    """手動觸發向交易所查詢當日歷史委託與成交，補回程式重啟後遺漏的紀錄。"""
    return trigger_history_sync()


@app.get("/scheduler-status")
def scheduler_status():
    """查看自動同步排程狀態與下次執行時間。"""
    jobs = []
    for job in _scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "id": job.id,
            "next_run": next_run.isoformat() if next_run else None,
        })
    return {
        "running": _scheduler.running,
        "jobs": jobs,
    }


# ==================== 帳務 / 部位 ====================

def _getattr2(obj, *names):
    """從物件取欄位，同時嘗試大寫與小寫名稱（相容 Unitrade SDK 不同版本）。"""
    for n in names:
        v = getattr(obj, n, None)
        if v is not None:
            return v
        v = getattr(obj, n.lower(), None)
        if v is not None:
            return v
    return None


@app.get("/positions")
def get_positions():
    """即時部位查詢 — daccount.get_position()

    回傳每個商品的留倉口數、平均成本、浮動損益等即時資訊。
    """
    try:
        api = get_unitrade_client()
    except UnitradeLoginError as exc:
        raise HTTPException(status_code=503, detail=f"Unitrade 連線失敗: {exc}")

    actno = os.getenv("UNITRADE_ACTNO", "")
    currency = os.getenv("UNITRADE_CURRENCY", "NTT")
    if not actno:
        raise HTTPException(status_code=500, detail="未設定 UNITRADE_ACTNO 環境變數")

    resp = api.daccount.get_position(actno, currency)
    if resp is None or not getattr(resp, "ok", False):
        err = getattr(resp, "error", "unknown") if resp else "no response"
        raise HTTPException(status_code=502, detail=f"即時部位查詢失敗: {err}")

    result = []
    for p in (resp.data or []):
        result.append({
            "product":          _getattr2(p, "PRODUCT"),
            "product_id":       _getattr2(p, "PRODUCTID"),
            "product_name":     _getattr2(p, "PRODUCT_NAME"),
            "product_kind":     _getattr2(p, "PRODUCTKIND"),
            "month":            _getattr2(p, "MONTH"),
            "call_put":         _getattr2(p, "CALL_PUT"),
            "strike_price":     _getattr2(p, "STRIKE_PRICE"),
            # 留倉口數
            "buy_open_qty":     _getattr2(p, "CURRENT_BUY_OPEN_POSITION"),
            "sell_open_qty":    _getattr2(p, "CURRENT_SELL_OPEN_POSITION"),
            # 前日留倉
            "ot_qty_b":         _getattr2(p, "OT_QTY_B"),
            "ot_qty_s":         _getattr2(p, "OT_QTY_S"),
            # 今日成交
            "today_match_b":    _getattr2(p, "NOWMATCH_QTY_B"),
            "today_match_s":    _getattr2(p, "NOWMATCH_QTY_S"),
            "today_close":      _getattr2(p, "TODAY_CLOSE_POSITION"),
            # 成本 / 損益
            "buy_avg_cost":     _getattr2(p, "OPEN_BUY_POSITION_AVERAGE_COST"),
            "sell_avg_cost":    _getattr2(p, "OPEN_SELL_POSITION_AVERAGE_COST"),
            "ref_price":        _getattr2(p, "REFERENCE_REALPRICE"),
            "floating_pnl":     _getattr2(p, "FLOATING_PNL"),
            "close_pnl":        _getattr2(p, "CLOSE_POSITION_PNL"),
        })
    return result


@app.get("/unliquidations")
def get_unliquidations():
    """未平倉查詢 — daccount.get_unliquidation()

    回傳留倉口數、成交均價、即時價、浮動損益、淨損益。
    """
    try:
        api = get_unitrade_client()
    except UnitradeLoginError as exc:
        raise HTTPException(status_code=503, detail=f"Unitrade 連線失敗: {exc}")

    actno = os.getenv("UNITRADE_ACTNO", "")
    currency = os.getenv("UNITRADE_CURRENCY", "NTT")
    if not actno:
        raise HTTPException(status_code=500, detail="未設定 UNITRADE_ACTNO 環境變數")

    resp = api.daccount.get_unliquidation(actno, currency)
    if resp is None or not getattr(resp, "ok", False):
        err = getattr(resp, "error", "unknown") if resp else "no response"
        raise HTTPException(status_code=502, detail=f"未平倉查詢失敗: {err}")

    result = []
    for u in (resp.data or []):
        result.append({
            "product_id":       _getattr2(u, "PRODUCTID"),
            "product_name":     _getattr2(u, "PRODUCT_NAME"),
            "bs":               _getattr2(u, "BS"),
            "total_qty":        _getattr2(u, "TOTALOTQTY"),
            "avg_match_price":  _getattr2(u, "AVGMATCHPRICE"),
            "real_price":       _getattr2(u, "REALPRICE"),
            "floating_pnl":     _getattr2(u, "REFTOTALPL"),
            "net_pnl":          _getattr2(u, "NET_PROFIT_LOSS"),
            "tax":              _getattr2(u, "CTAXAMT"),
            "commission":       _getattr2(u, "COMMISSION_FEE"),
            "multiname":        _getattr2(u, "MULTINAME"),
        })
    return result
