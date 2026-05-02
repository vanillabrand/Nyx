import { parseMetar } from "metar-taf-parser";
import type { IMetar, IWeatherCondition } from "metar-taf-parser";

export interface DecodedMetar {
  raw: string;
  wind: {
    speed: number;
    direction: number | string;
    unit: string;
  } | null;
  visibility: {
    value: number;
    unit: string;
  } | null;
  temperature: number | null;
  altimeter: {
    value: number;
    unit: string;
  } | null;
  conditions: string[];
}

export class MetarService {
  /**
   * Parses a raw METAR string into a simplified, display-friendly object.
   */
  public static decode(rawMetar: string): DecodedMetar | null {
    if (!rawMetar) return null;

    try {
      // Clean the string (sometimes contains extra text or prefixes)
      const cleanMetar = rawMetar.replace(/Metars:/i, '').trim();
      const parsed: IMetar = parseMetar(cleanMetar);

      const conditions: string[] = [];
      if (parsed.weatherConditions) {
        parsed.weatherConditions.forEach((cond: IWeatherCondition) => {
          let str = '';
          if (cond.intensity) str += cond.intensity;
          if (cond.descriptive) str += cond.descriptive;
          if (cond.phenomenons) str += cond.phenomenons.join('');
          if (str) conditions.push(str);
        });
      }

      return {
        raw: cleanMetar,
        wind: parsed.wind ? {
          speed: parsed.wind.speed,
          direction: parsed.wind.direction || 'VRB',
          unit: parsed.wind.unit || 'KT'
        } : null,
        visibility: parsed.visibility ? {
          value: parsed.visibility.value,
          unit: parsed.visibility.unit || 'M'
        } : null,
        temperature: parsed.temperature !== undefined ? parsed.temperature : null,
        altimeter: parsed.altimeter ? {
          value: parsed.altimeter.value,
          unit: parsed.altimeter.unit || 'hPa'
        } : null,
        conditions
      };
    } catch (error) {
      console.warn("Failed to parse METAR:", rawMetar, error);
      return {
        raw: rawMetar,
        wind: null,
        visibility: null,
        temperature: null,
        altimeter: null,
        conditions: []
      };
    }
  }
}
