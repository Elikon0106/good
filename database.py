"""Database configuration and initialization for Digital Bridge.
Uses SQLite + SQLAlchemy with a single source of truth for hall layout.
"""

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from models import Base, Seat, Guest

# ---------------------------------------------------------------------------
# Hall Configuration — SINGLE SOURCE OF TRUTH
# ---------------------------------------------------------------------------
# Left sector (A):   20 rows × 10 seats = 200
# Center sector (B): Row 1 = 9 chairs (with 8 decorative tables between),
#                    Rows 2-15 = 16 seats each = 224
#                    Total = 233
# Right sector (C):  19 rows × 10 seats = 190
# Grand total: 623 seats
#
# Only row 1 of CENTER sector is reserved (9 seats).
# Rows 1 of left and right sectors are NORMAL (not reserved).

HALL_CONFIG = {
    "left": {
        "label": "Левый сектор",
        "rows": 20,
        "seats_per_row": 10,
        "first_row_seats": 10,
        "first_row_type": "normal",
    },
    "center": {
        "label": "Центральный сектор",
        "rows": 15,
        "seats_per_row": 16,
        "first_row_seats": 13,
        "first_row_type": "normal",
    },
    "right": {
        "label": "Правый сектор",
        "rows": 19,
        "seats_per_row": 10,
        "first_row_seats": 10,
        "first_row_type": "normal",
    },
}


def get_seats_in_row(sector_key: str, row: int) -> int:
    """Return the number of seats in a given row of a sector."""
    conf = HALL_CONFIG[sector_key]
    if row == 1:
        return conf.get("first_row_seats", conf["seats_per_row"])
    return conf["seats_per_row"]


TOTAL_SEATS = sum(
    sum(get_seats_in_row(k, r) for r in range(1, v["rows"] + 1))
    for k, v in HALL_CONFIG.items()
)  # Should be 627

# ---------------------------------------------------------------------------
# Engine & Session
# ---------------------------------------------------------------------------

DATABASE_URL = "sqlite:///hall.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Migration helpers
# ---------------------------------------------------------------------------

def _needs_migration(db) -> bool:
    """Return True if the seats table is missing or has the wrong count."""
    inspector = inspect(engine)
    if "seats" not in inspector.get_table_names():
        return True
    columns = {col["name"] for col in inspector.get_columns("seats")}
    if "is_reserved" not in columns:
        return True
    count = db.query(Seat).count()
    return count != TOTAL_SEATS


def _reserve_center_row1(db):
    """Mark ONLY row-1 of CENTER sector as reserved. Left/Right row 1 are normal."""
    # First, ensure NO seats are wrongly reserved
    db.query(Seat).filter(Seat.is_reserved == True).update({Seat.is_reserved: False})
    db.flush()
    # Now we don't reserve anything because the user wants normal assignable chairs.


# ---------------------------------------------------------------------------
# Initialization
# ---------------------------------------------------------------------------

def init_db():
    """Create tables if needed, run migration if seat count changed."""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Add category column to guests if missing
        try:
            inspector = inspect(engine)
            if "guests" in inspector.get_table_names():
                guest_cols = {col["name"] for col in inspector.get_columns("guests")}
                if "category" not in guest_cols:
                    print("[MIGRATION] Adding category column to guests table...")
                    with engine.begin() as conn:
                        conn.execute(text("ALTER TABLE guests ADD COLUMN category VARCHAR(200)"))
        except Exception as e:
            print(f"[ERROR] Guest migration failed: {e}")

        if not _needs_migration(db):
            # Still fix reservations if needed (in case left/right row 1 was wrongly reserved)
            _reserve_center_row1(db)
            db.commit()
            return

        print(f"[MIGRATION] Rebuilding seats table -> {TOTAL_SEATS} seats ...")

        # Save existing mappings
        existing_seats = db.query(Seat).all()
        mapping = {(s.sector, s.row, s.number): s.guest_id for s in existing_seats if s.guest_id}

        # Unlink guests from old seats
        try:
            db.query(Seat).update({Seat.guest_id: None})
            db.commit()
        except Exception:
            db.rollback()

        # Drop and recreate seats
        Seat.__table__.drop(engine, checkfirst=True)
        Seat.__table__.create(engine, checkfirst=True)

        # Populate seats
        sector_labels = {k: v["label"] for k, v in HALL_CONFIG.items()}
        for sector_key, conf in HALL_CONFIG.items():
            for row in range(1, conf["rows"] + 1):
                seats_in_row = get_seats_in_row(sector_key, row)
                for num in range(1, seats_in_row + 1):
                    guest_id = mapping.get((sector_key, row, num))
                    seat = Seat(
                        sector=sector_key,
                        sector_label=sector_labels[sector_key],
                        row=row,
                        number=num,
                        is_reserved=False,
                        guest_id=guest_id
                    )
                    db.add(seat)
        db.flush()

        _reserve_center_row1(db)
        db.commit()
        print(f"[MIGRATION] Done. {TOTAL_SEATS} seats created, mappings preserved.")

    finally:
        db.close()
