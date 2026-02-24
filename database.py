import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/trade_api"
)

# connect_timeout=5 讓連線失敗快速返回錯誤，而非無限 hang
engine = create_engine(
    DATABASE_URL,
    connect_args={"connect_timeout": 5},
    pool_pre_ping=True,
    pool_timeout=10,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

