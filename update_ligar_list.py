import csv
import json
import os

def main():
    csv_path = "ref/adaptation_2026-02-13_19h51m18.csv"
    output_file = "data/ligar_devices.json"

    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        return

    print(f"Reading CSV from {csv_path}...")
    
    devices = []
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            # Check if headers are as expected
            first_line = f.readline()
            # print(f"Header: {first_line}")
            f.seek(0)
            
            reader = csv.DictReader(f)
            
            for row in reader:
                brand = row.get('Brand', '').strip()
                
                # Adapted status
                adapted = row.get('Adapted', '').strip().lower()
                status = 'unknown'
                if adapted == 'true':
                    status = 'supported'
                elif adapted == 'false':
                    status = 'unsupported'

                # Collect potential model names
                potential_models = set()
                
                # 1. Device model name (e.g. "Samsung Galaxy A42 5G")
                dmn = row.get('Device model name', '').strip()
                if dmn and dmn != '-':
                    potential_models.add(dmn)
                    
                # 2. Model (e.g. "SM-A426B")
                model_code = row.get('Model', '').strip()
                if model_code and model_code != '-':
                     potential_models.add(model_code)
                
                for m_name in potential_models:
                     # Cleanup
                     m_name_clean = m_name.replace('\n', '').strip()
                     
                     if brand and m_name_clean:
                        devices.append({
                            "manufacturer": brand,
                            "model": m_name_clean,
                            "status": status
                        })
    except Exception as e:
        print(f"Error parsing CSV: {e}")
        return

    # Remove duplicates? 
    # Logic: If same model appears multiple times, which one takes precedence?
    # Usually latest entry? Or if any is supported?
    # For simplicity, we just keep all unique entries. 
    # But wait, same model might have different status if updated.
    # The CSV has 'Updated at'. But standard DictReader doesn't sort.
    # Let's assume the list is roughly chronological or duplicates are identical.
    # We will dedup based on manufacturer + model, keeping the last one seen (assuming append order)
    # Actually, let's just dump distinct entries.
    
    unique_map = {}
    for d in devices:
        key = (d['manufacturer'].lower(), d['model'].lower())
        unique_map[key] = d # Overwrite with latest if duplicates exist
        
    final_list = list(unique_map.values())
    
    print(f"Found {len(final_list)} unique devices.")
    
    print(f"Writing to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_list, f, indent=2, ensure_ascii=False)
        
    print("Done.")

if __name__ == "__main__":
    main()
