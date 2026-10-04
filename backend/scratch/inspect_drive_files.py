import csv
import io
import sys
from app.services.google_drive_service import google_drive_service
from app.services.revolut_csv_parser import RevolutCsvParser

tree = google_drive_service.get_drive_tree()
categories = tree.get("categories", {})

for cat_name, cat_data in categories.items():
    print(f"\n==================== {cat_name}: {cat_data.get('label')} ====================")
    for f in cat_data.get("files", []):
        name = f["name"]
        fid = f["id"]
        if name.endswith(".csv"):
            data = google_drive_service.download_file_bytes(fid).decode("utf-8", errors="ignore")
            lines = [l for l in data.split("\n") if l.strip()]
            print(f"\n--- File: {name} (lines: {len(lines)}) ---")
            print(f"Header: {lines[0] if lines else 'EMPTY'}")
            
            # Print unique values in Type or transaction columns
            reader = csv.DictReader(io.StringIO(data))
            all_rows = list(reader)
            if all_rows:
                sample_keys = list(all_rows[0].keys())
                print(f"Columns: {sample_keys}")
                types = set(r.get("Type") or r.get("type") or "" for r in all_rows)
                print(f"Types present: {types}")
                
                div_rows = [r for r in all_rows if "DIV" in str(r).upper()]
                print(f"Dividend occurrences in file: {len(div_rows)}")
                for d in div_rows:
                    print("  DIV ROW:", d)

                if "crypto" in name.lower() or "crypto" in cat_name.lower():
                    print(f"Total crypto rows: {len(all_rows)}")
                    for r in all_rows[:15]:
                        print("  CRYPTO ROW:", r)
