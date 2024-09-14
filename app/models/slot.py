from app import db
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.sql import func

class Slot(db.Model):
    __tablename__ = 'slots'

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    rtp = Column(Float)
    volatility = Column(Integer)
    potential = Column(Float)
    image = Column(String)
    best_x = Column(Float)
    best_euro = Column(Integer)
    creation_date = Column(DateTime, default=func.current_timestamp())
    active = Column(Boolean, default=True)

    def __repr__(self):
        return f'<Slot {self.name}>'