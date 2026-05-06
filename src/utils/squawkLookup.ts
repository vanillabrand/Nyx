export const SQUAWK_CODES: Record<string, string> = {
  // Emergency
  '7500': 'HIJACK / UNLAWFUL INTERFERENCE',
  '7600': 'RADIO FAILURE / LOST COMM',
  '7700': 'GENERAL EMERGENCY',
  
  // Standard Regions / Usage
  '1200': 'VFR FLIGHT (STANDARD)',
  '2000': 'IFR FLIGHT (UNASSIGNED)',
  '0000': 'NON-SPECIFIC / UNASSIGNED',
  '7000': 'VFR FLIGHT (EUROPE)',
  '7004': 'AEROBATIC / DISPLAY FLIGHT',
  '0033': 'PARACHUTE DROPPING',
  
  // Military Section
};

export function lookupSquawk(squawk: string | number | undefined): string {
  if (!squawk) return 'UNKNOWN SQUAWK';
  const code = String(squawk).padStart(4, '0');
  return SQUAWK_CODES[code] || `DISCRETE (ATC ASSIGNED: ${code})`;
}
