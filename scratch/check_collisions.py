import json

with open('src/constants/airline_lookup.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

targets = ['EBB', 'DAY', 'LAS', 'E120']
for a in data:
    for t in targets:
        if t in [a.get('name', '').upper(), a.get('iata', '').upper(), a.get('icao', '').upper(), a.get('callsign', '').upper()]:
            print(f"Match found: {a}")
