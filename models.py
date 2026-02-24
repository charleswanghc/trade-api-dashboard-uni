from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float, Enum, Boolean, Text, JSON
import enum

from database import Base


class OrderAction(str, enum.Enum):
    LONG_ENTRY = "long_entry"
    LONG_EXIT = "long_exit"
    SHORT_ENTRY = "short_entry"
    SHORT_EXIT = "short_exit"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    FILLED = "filled"
    PARTIAL_FILLED = "partial_filled"
    CANCELLED = "cancelled"
    FAILED = "failed"
    NO_ACTION = "no_action"


class SignalType(str, enum.Enum):
    LONG_ENTRY = "long_entry"
    LONG_EXIT = "long_exit"
    SHORT_ENTRY = "short_entry"
    SHORT_EXIT = "short_exit"


class OrderHistory(Base):
    __tablename__ = "order_history"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, nullable=False, index=True)  # 商品代碼 (例：TXFF5)
    code = Column(String, nullable=True, index=True)  # 可選擇填入交易所代碼
    action = Column(String, nullable=False)  # B/S
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=True)
    strategy = Column(String, nullable=True)
    order_type = Column(String, nullable=True)  # L/M/P
    order_condition = Column(String, nullable=True)  # I/R/F
    open_close_flag = Column(String, nullable=True)  # 0/1/''
    dtrade = Column(String, nullable=True)  # Y/N
    note = Column(String, nullable=True)
    account = Column(String, nullable=True)
    sub_account = Column(String, nullable=True)
    source = Column(String, nullable=True)  # webhook or manual
    status = Column(String, nullable=False)
    order_result = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Order tracking fields (from Shioaji Trade object)
    order_id = Column(String, nullable=True, index=True)  # Trade.order.id
    seqno = Column(String, nullable=True)  # Trade.order.seqno
    ordno = Column(String, nullable=True)  # Trade.order.ordno
    
    # Fill tracking fields
    fill_status = Column(String, nullable=True)  # Status from exchange: PendingSubmit, Submitted, Filled, etc.
    fill_quantity = Column(Integer, nullable=True)  # Actual filled quantity
    fill_price = Column(Float, nullable=True)  # Average fill price
    cancel_quantity = Column(Integer, nullable=True)  # Cancelled quantity
    updated_at = Column(DateTime, nullable=True)  # Last status update time

    def to_dict(self):
        return {
            "id": self.id,
            "symbol": self.symbol,
            "code": self.code,
            "action": self.action,
            "quantity": self.quantity,
            "price": self.price,
            "strategy": self.strategy,
            "order_type": self.order_type,
            "order_condition": self.order_condition,
            "open_close_flag": self.open_close_flag,
            "dtrade": self.dtrade,
            "note": self.note,
            "account": self.account,
            "sub_account": self.sub_account,
            "source": self.source,
            "status": self.status,
            "order_result": self.order_result,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "order_id": self.order_id,
            "fill_status": self.fill_status,
            "fill_quantity": self.fill_quantity,
            "fill_price": self.fill_price,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class StrategyConfig(Base):
    __tablename__ = "strategy_config"

    id = Column(Integer, primary_key=True, index=True)
    strategy_name = Column(String(50), unique=True, nullable=False, index=True)
    
    # 商品映射設定
    source_product = Column(String(20), nullable=False)  # 訊號中的商品代碼
    target_product = Column(String(20), nullable=False)  # 實際下單的商品代碼
    
    # 數量設定
    quantity_multiplier = Column(Integer, default=1)  # 口數倍數
    max_position = Column(Integer, default=10)  # 最大持倉口數
    
    # 下單參數設定
    order_type = Column(String(1), default="L")  # L/M/P
    order_condition = Column(String(1), default="R")  # I/R/F
    dtrade = Column(String(1), default="N")  # Y/N
    
    # 進場設定
    entry_order_type = Column(String(1), default="L")
    entry_order_condition = Column(String(1), default="R")
    
    # 出場設定
    exit_order_type = Column(String(1), default="M")
    exit_order_condition = Column(String(1), default="I")
    
    # 帳號設定
    account = Column(String(50), nullable=True)
    sub_account = Column(String(10), default="")
    
    # 狀態
    enabled = Column(Boolean, default=True)
    
    # 備註
    description = Column(Text, nullable=True)
    
    # 時間戳記
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "strategy_name": self.strategy_name,
            "source_product": self.source_product,
            "target_product": self.target_product,
            "quantity_multiplier": self.quantity_multiplier,
            "max_position": self.max_position,
            "order_type": self.order_type,
            "order_condition": self.order_condition,
            "dtrade": self.dtrade,
            "entry_order_type": self.entry_order_type,
            "entry_order_condition": self.entry_order_condition,
            "exit_order_type": self.exit_order_type,
            "exit_order_condition": self.exit_order_condition,
            "account": self.account,
            "sub_account": self.sub_account,
            "enabled": self.enabled,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class SignalHistory(Base):
    __tablename__ = "signal_history"

    id = Column(Integer, primary_key=True, index=True)
    strategy_name = Column(String(50), nullable=False, index=True)
    
    # 訊號內容
    signal_type = Column(String(20), nullable=False)
    signal_product = Column(String(20), nullable=True)
    signal_quantity = Column(Integer, nullable=True)
    signal_price = Column(Float, nullable=True)
    signal_note = Column(String(50), nullable=True)
    
    # 實際下單資訊
    actual_product = Column(String(20), nullable=True)
    actual_quantity = Column(Integer, nullable=True)
    actual_bs = Column(String(1), nullable=True)
    
    # 處理結果
    status = Column(String(20), nullable=False)  # processed, ignored, failed
    order_id = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
    
    # 原始資料
    raw_payload = Column(JSON, nullable=True)
    
    # 時間戳記
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "strategy_name": self.strategy_name,
            "signal_type": self.signal_type,
            "signal_product": self.signal_product,
            "signal_quantity": self.signal_quantity,
            "signal_price": self.signal_price,
            "signal_note": self.signal_note,
            "actual_product": self.actual_product,
            "actual_quantity": self.actual_quantity,
            "actual_bs": self.actual_bs,
            "status": self.status,
            "order_id": self.order_id,
            "error_message": self.error_message,
            "raw_payload": self.raw_payload,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
