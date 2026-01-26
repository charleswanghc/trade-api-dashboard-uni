import logging
import os
from datetime import datetime
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from database import get_db
from models import OrderHistory
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
        raise HTTPException(status_code=500, detail=str(exc)) from exc

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