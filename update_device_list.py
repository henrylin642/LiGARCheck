import csv
import json
import urllib.request
import ssl

def main():
    url = "https://raw.githubusercontent.com/rolandsmeenk/ARCore-devices/master/arcore_devicelist.csv"
    output_file = "data/arcore_devices.json"

    # Create SSL context to ignore certificate errors (just in case)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        print(f"Downloading CSV from {url}...")
        with urllib.request.urlopen(url, context=ctx) as response:
            csv_content = response.read().decode('utf-8')
        
        print("Parsing CSV...")
        csv_reader = csv.DictReader(csv_content.splitlines())
        
        devices = []
        for row in csv_reader:
            # The CSV headers are: Brand, Device, Manufacturer, Model Name, ...
            # We want "manufacturer" and "model"
            if row['Manufacturer'] and row['Model Name']:
                devices.append({
                    "manufacturer": row['Manufacturer'],
                    "model": row['Model Name']
                })
        
        # Remove duplicates
        unique_devices = []
        seen = set()
        for d in devices:
            key = (d['manufacturer'], d['model'])
            if key not in seen:
                seen.add(key)
                unique_devices.append(d)
        
        print(f"Found {len(unique_devices)} unique devices.")
        
        print(f"Writing to {output_file}...")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(unique_devices, f, indent=2, ensure_ascii=False)
            
        print("Done.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
