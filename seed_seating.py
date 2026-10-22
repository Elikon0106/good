import sys
import csv
import uuid
from sqlalchemy.orm import Session
from database import engine, get_db, TOTAL_SEATS
from models import Seat, Guest

def main():
    if len(sys.argv) < 2:
        print("Usage: python seed_seating.py <csv_file>")
        sys.exit(1)
        
    csv_file = sys.argv[1]
    
    sector_map = {
        'A': 'left',
        'B': 'center',
        'C': 'right'
    }
    
    print(f"Reading {csv_file}...")
    
    rows_data = []
    try:
        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows_data.append(row)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        sys.exit(1)
        
    if len(rows_data) != 624:
        print(f"ERROR: Expected 624 rows, found {len(rows_data)}")
        sys.exit(1)
        
    db: Session = next(get_db())
    
    db_seats = db.query(Seat).all()
    if len(db_seats) != 624:
        print(f"ERROR: Database has {len(db_seats)} seats instead of 624. Run migration first.")
        sys.exit(1)
        
    seat_dict = {(s.sector, s.row, s.number): s for s in db_seats}
    
    # Validation step
    errors = []
    matched_seats = []
    for r in rows_data:
        sec = sector_map.get(r['sector'])
        row_num = int(r['row'])
        pos = int(r['seat_position']) if r['seat_position'] else None
        
        # In the CSV, row 1 of B has seat_position empty. The user said:
        # "в B-ряду 1 это 1–9 (только стулья, столики не считаются)"
        # Let's check how they are stored in the CSV.
        # Looking at the CSV: B,1,1,,VIP,,reserved -> seat_position is 1
        if pos is None:
            # Maybe seat_position is not empty. Let's rely on pos.
            pass
            
        if (sec, row_num, pos) not in seat_dict:
            errors.append(f"Seat not found for CSV row: {r}")
        else:
            matched_seats.append((r, seat_dict[(sec, row_num, pos)]))
            
    if errors:
        print("Validation errors:")
        for e in errors[:10]:
            print(e)
        if len(errors) > 10:
            print(f"... and {len(errors) - 10} more.")
        sys.exit(1)
        
    if len(matched_seats) != 624:
        print(f"ERROR: Only matched {len(matched_seats)} out of 624 seats.")
        sys.exit(1)
        
    print("Validation passed! 624 seats mapped successfully.")
    
    try:
        # Unlink all guests
        db.query(Seat).update({Seat.guest_id: None})
        # Delete all guests
        db.query(Guest).delete()
        # Reset all reservations
        db.query(Seat).update({Seat.is_reserved: False})
        
        # Process rows
        stats = {'A': 0, 'B': 0, 'C': 0}
        kind_stats = {'named': 0, 'label': 0, 'reserved': 0, 'empty': 0}
        label_details = {}
        
        for r, seat in matched_seats:
            kind = r['kind'].strip()
            kind_stats[kind] = kind_stats.get(kind, 0) + 1
            
            if kind == 'reserved':
                seat.is_reserved = True
            elif kind in ('named', 'label'):
                name = r['value'].strip()
                cat = r['category'].strip() if r['category'] else None
                
                guest = Guest(
                    name=name,
                    category=cat,
                    token=str(uuid.uuid4())
                )
                db.add(guest)
                db.flush()
                seat.guest_id = guest.id
                
                stats[r['sector']] += 1
                
                if kind == 'label':
                    label_details[name] = label_details.get(name, 0) + 1
                    
        db.commit()
        
        print("\n--- ЗАГРУЗКА ЗАВЕРШЕНА УСПЕШНО ---")
        print(f"Строк в CSV: {len(rows_data)}. Сопоставлено с местами: {len(matched_seats)}.")
        print(f"Назначено гостей: A = {stats['A']}, B = {stats['B']}, C = {stats['C']}, итого {sum(stats.values())}.")
        print(f"Зарезервировано: {kind_stats.get('reserved', 0)} (1-й ряд B). Свободно: {kind_stats.get('empty', 0)}.")
        
        label_str = ", ".join([f"{k} {v}" for k, v in label_details.items()])
        print(f"named: {kind_stats.get('named', 0)}, label: {kind_stats.get('label', 0)} ({label_str}).")
        
        total_mapped = sum(stats.values()) + kind_stats.get('reserved', 0) + kind_stats.get('empty', 0)
        print(f"Проверка: назначено + зарезервировано + свободно = {total_mapped}.")
        
        print("\nПримеры:")
        import random
        examples = [m for m in matched_seats if m[0]['kind'] in ('named', 'label')]
        for r, s in random.sample(examples, min(3, len(examples))):
            cat_str = f" ({r['category']})" if r['category'] else ""
            print(f"{r['sector']}/{r['row']}/{r['seat_position']} -> {r['value']}{cat_str}")
            
    except Exception as e:
        db.rollback()
        print(f"Transaction failed, rolled back. Error: {e}")
        sys.exit(1)
        
if __name__ == "__main__":
    main()
