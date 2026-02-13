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
                # Use 'Device model name' as the primary model name, fallback to 'Model'
                model_name = row.get('Device model name', '').strip()
                if not model_name or model_name == '-':
                    model_name = row.get('Model', '').strip()
                
                # Cleanup model name (remove quotes, newlines if any remain after csv parsing)
                model_name = model_name.replace('\n', '').strip()
                
                # Adapted status
                adapted = row.get('Adapted', '').strip().lower()
                status = 'unknown'
                if adapted == 'true':
                    status = 'supported'
                elif adapted == 'false':
                    status = 'unsupported'
                
                if brand and model_name and model_name != '-':
                    devices.append({
                        "manufacturer": brand,
                        "model": model_name,
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
