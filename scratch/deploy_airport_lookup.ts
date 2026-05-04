import fs from 'fs';
import path from 'path';

// Tactical manual mapping of major airports (Safe and stable)
const lookup: Record<string, string> = {
  "london heathrow": "LHR",
  "london gatwick": "LGW",
  "london stansted": "STN",
  "new york jfk": "JFK",
  "newark": "EWR",
  "boston": "BOS",
  "chicago o'hare": "ORD",
  "chicago": "ORD",
  "los angeles": "LAX",
  "sao paulo": "GRU",
  "dubai": "DXB",
  "paris cdg": "CDG",
  "frankfurt": "FRA",
  "amsterdam": "AMS",
  "singapore": "SIN",
  "hong kong": "HKG",
  "tokyo": "NRT",
  "san francisco": "SFO",
  "miami": "MIA",
  "dallas": "DFW",
  "atlanta": "ATL",
  "denver": "DEN",
  "toronto": "YYZ",
  "vancouver": "YVR",
  "sydney": "SYD",
  "melbourne": "MEL",
  "auckland": "AKL",
  "bangkok": "BKK",
  "seoul": "ICN",
  "shanghai": "PVG",
  "beijing": "PEK",
  "delhi": "DEL",
  "mumbai": "BOM",
  "doha": "DOH",
  "istanbul": "IST",
  "madrid": "MAD",
  "barcelona": "BCN",
  "lisbon": "LIS",
  "rome": "FCO",
  "milan": "MXP",
  "munich": "MUC",
  "vienna": "VIE",
  "zurich": "ZRH",
  "geneva": "GVA",
  "copenhagen": "CPH",
  "oslo": "OSL",
  "stockholm": "ARN",
  "helsinki": "HEL",
  "warsaw": "WAW",
  "prague": "PRG",
  "budapest": "BUD",
  "athens": "ATH",
  "tel aviv": "TLV",
  "cairo": "CAI",
  "johannesburg": "JNB",
  "nairobi": "NBO",
  "mexico city": "MEX",
  "bogota": "BOG",
  "lima": "LIM",
  "santiago": "SCL",
  "buenos aires": "EZE",
  "rio de janeiro": "GIG"
};

const targetPath = path.join(process.cwd(), 'src/constants/airport_lookup.json');
const targetDir = path.dirname(targetPath);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.writeFileSync(targetPath, JSON.stringify(lookup, null, 2));
console.log(`✅ [HUD] Tactical airport lookup table deployed to ${targetPath}`);
