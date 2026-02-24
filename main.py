import logging
import os
from datetime import datetime
from typing import Literal, Optional, List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from database import get_db
from models import OrderHistory, StrategyConfig, SignalHistory, SignalType
from unitrade.dtrade_data import DOrderObject

from unitrade_client import (
    UnitradeLoginError,
    extract_order_id,
    get_unitrade_client,
    serialize_order_result,
)

logger = logging.getLogger(__name__)


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
    description: Optional[str] = None


def submit_unitrade_order(
    payload: OrderRequest,
    db: Session,
    source: str,
) -> OrderResponse:
    logger.info("Order request received: source=%s productid=%s bs=%s qty=%s", source, payload.productid, payload.bs, payload.orderqty)
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
        raise HTTPException(status_code=500, detail=str(exc)) from exc@app.post("/signal/simple", response_model=SignalResponse)
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
    logger.info("Simple signal received: strategy=%s action=%s side=%s qty=%s", 
                signal.strategy, signal.action, signal.side, signal.quantity)
    
    # 轉換為標準訊號格式
    if signal.action == "entry":
        if signal.side == "buy":
            signal_type = "long_entry"
        else:
            signal_type = "short_entry"
    else:  # exit
        if signal.side == "sell":
            signal_type = "long_exit"
        else:
            signal_type = "short_exit"
    
    # 建立標準訊號請求
    standard_signal = SignalRequest(
        strategy=signal.strategy,
        signal=signal_type,
        quantity=signal.quantity,
        price=signal.price,
        note=signal.note or f"{signal.action}_{signal.side}"
    )
    
    # 使用標準訊號處理流程
    return process_signal(standard_signal, db)

signal", response_model=SignalResponse)
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
    logger.info("Signal received: strategy=%s signal=%s qty=%s", signal.strategy, signal.signal, signal.quantity)
    
    # 查詢策略設定
    strategy_config = db.query(StrategyConfig).filter(
        StrategyConfig.strategy_name == signal.strategy
    ).first()
    
    if not strategy_config:
        # 記錄失敗的訊號
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
            message=f"策略 '{signal.strategy}' 已停用"
        )
    
    # 計算實際下單參數
    actual_product = strategy_config.target_product
    actual_quantity = signal.quantity * strategy_config.quantity_multiplier
    
    # 判斷買賣方向
    if signal.signal in ("long_entry", "short_exit"):
        actual_bs = "B"
    else:  # long_exit, short_entry


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
    # 檢查是否已存在
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
    
    # 更新欄位
    for key, value in config.model_dump().items():
        if key != "strategy_name":  # 不允許修改策略名稱
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
        
        # 更新訊號記錄
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


@app.post("/
    order_id = extract_order_id(result) or getattr(result, "seq", None)
    order_record.order_id = order_id
    order_record.status = "submitted"
    order_record.order_result = serialize_order_result(result)
    order_record.updated_at = datetime.utcnow()
    db.commit()

    result_dict = None
    if isinstance(result, dict):
        result_dict = result

    return OrderResponse(status="ok", order_id=order_id, result=result_dict)


app = FastAPI()

cors_origins = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/health")
def health_check():
    try:
        _ = get_unitrade_client()
        return {"status": "ok", "unitrade": "connected"}
    except Exception as exc:
        return {"status": "degraded", "unitrade": "error", "error": str(exc)}


@app.post("/webhook", response_model=OrderResponse)
def tradingview_webhook(
    payload: OrderRequest,
    db: Session = Depends(get_db),
):
    return submit_unitrade_order(payload, db, source="webhook")


@app.post("/order", response_model=OrderResponse)
def manual_order(
    payload: OrderRequest,
    db: Session = Depends(get_db),
):
    return submit_unitrade_order(payload, db, source="manual")


@app.get("/orders")
def list_orders(
    db: Session = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    orders = (
        db.query(OrderHistory)
        .order_by(OrderHistory.created_at.desc())
        .offset(offset)
        .limit(min(limit, 1000))
        .all()
    )
    return [o.to_dict() for o in orders]