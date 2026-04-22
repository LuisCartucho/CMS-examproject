from sqlalchemy import create_engine, Column, String, Text, DateTime, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

DATABASE_URL = "sqlite:///./medradio.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class SessionRecord(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    scenario_id = Column(String, nullable=True)

class ExchangeRecord(Base):
    __tablename__ = "exchanges"

    id = Column(String, primary_key=True)
    session_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    report_json = Column(Text)
    review_json = Column(Text, nullable=True)
    response_json = Column(Text, nullable=True)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()