"""SQLAlchemy ORM models for the seating application."""

import uuid
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Guest(Base):
    """Represents a guest with a permanent ID and QR token."""
    __tablename__ = "guests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    category = Column(String(200), nullable=True)
    token = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))

    # Relationship to seat (one guest can occupy one seat)
    seat = relationship("Seat", back_populates="guest", uselist=False)

    def to_dict(self, include_seat=False):
        data = {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "token": self.token,
        }
        if include_seat and self.seat:
            data["seat"] = {
                "id": self.seat.id,
                "sector": self.seat.sector,
                "sector_label": self.seat.sector_label,
                "row": self.seat.row,
                "number": self.seat.number,
            }
        return data


class Seat(Base):
    """Represents a single seat in the auditorium."""
    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sector = Column(String(20), nullable=False)       # "left", "center", "right"
    sector_label = Column(String(30), nullable=False)  # "Левый", "Центральный", "Правый"
    row = Column(Integer, nullable=False)               # 1-19 (or 1-18 for center)
    number = Column(Integer, nullable=False)             # seat number within row

    # Reserved seats (row 1 in all sectors) — permanently occupied, no guest data
    is_reserved = Column(Boolean, nullable=False, default=False)

    # FK to guest (nullable = seat is free)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=True, unique=True)
    guest = relationship("Guest", back_populates="seat")

    @property
    def is_occupied(self):
        return self.is_reserved or self.guest_id is not None

    @property
    def guest_name(self):
        if self.is_reserved:
            return None
        return self.guest.name if self.guest else None

    def to_dict(self):
        """Return seat data as dict. Reserved seats never expose guest info."""
        if self.is_reserved:
            return {
                "id": self.id,
                "sector": self.sector,
                "sector_label": self.sector_label,
                "row": self.row,
                "number": self.number,
                "guest_id": None,
                "guest_name": None,
                "guest_category": None,
                "guest_token": None,
                "is_occupied": True,
                "is_reserved": True,
            }
        return {
            "id": self.id,
            "sector": self.sector,
            "sector_label": self.sector_label,
            "row": self.row,
            "number": self.number,
            "guest_id": self.guest_id,
            "guest_name": self.guest.name if self.guest else None,
            "guest_category": self.guest.category if self.guest else None,
            "guest_token": self.guest.token if self.guest else None,
            "is_occupied": self.is_occupied,
            "is_reserved": False,
        }
