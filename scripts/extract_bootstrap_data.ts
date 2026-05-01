import fs from 'fs';

function extractConstants() {
  const content = fs.readFileSync('C:/Users/bruce/Downloads/av_constants.R', 'utf-8');
  
  // Extract Aircraft
  const aircraftTypes: any[] = [];
  const lines = content.split('\n');
  let currentManufacturer = '';
  let currentFamily = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('####')) {
      currentManufacturer = line.replace(/#/g, '').replace('##', '').trim();
    }
    if (line.includes('family"=list')) {
      currentFamily = line.match(/"(.*?)"/)?.[1] || currentFamily;
    }

    const modelMatch = line.match(/"(.*?)"=c\((.*?)\)/);
    if (modelMatch) {
      const icaoCode = modelMatch[1];
      const aliases = modelMatch[2].replace(/"/g, '').split(',').map(s => s.trim());
      aircraftTypes.push({
        icaoCode,
        manufacturer: currentManufacturer,
        family: currentFamily,
        modelName: aliases[0],
        aliases
      });
    }
  }

  // Extract Airlines (Robust multi-line approach)
  const airlineStart = content.indexOf('AIRLINES=list(');
  const airlineEnd = content.lastIndexOf(')'); 
  const airlineText = content.substring(airlineStart, airlineEnd);
  
  const airlines: string[] = [];
  const airlineMatches = airlineText.matchAll(/"(.*?)"/g);
  for (const match of airlineMatches) {
    if (match[1].length > 2) airlines.push(match[1]);
  }

  const result = {
    aircraftTypes,
    airlines: [...new Set(airlines)]
  };

  fs.writeFileSync('C:/Users/bruce/Will_Flight_Query_Analyser/src/constants/bootstrap_data.json', JSON.stringify(result, null, 2));
  console.log(`Extracted ${aircraftTypes.length} aircraft types and ${result.airlines.length} airlines.`);
}

extractConstants();
