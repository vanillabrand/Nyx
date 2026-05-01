import { DetailedIncident } from './AviationHeraldScraper';

export interface SourceAuthority {
  sourceId: string;
  rank: number;
}

export class ReconciliationEngine {
  private static AUTHORITY_RANKS: Record<string, number> = {
    'FINAL_REPORT': 1.0,
    'NTSB': 0.95,
    'FAA': 0.9,
    'EASA': 0.9,
    'AVH': 0.7,
    'ASN': 0.8
  };

  /**
   * Reconciles multiple source reports into a single canonical Incident.
   * Uses Source Authority Ranking (SAR) to resolve conflicts.
   */
  public static reconcile(existing: any, incoming: DetailedIncident, sourceId: string) {
    const incomingRank = this.AUTHORITY_RANKS[sourceId] || 0.5;
    const existingRank = existing.confidenceScore || 0;

    const reconciled = { ...existing };

    // If incoming source has higher or equal authority, it can update "Truth" fields
    if (incomingRank >= existingRank) {
      reconciled.eventDate = incoming.eventDate || existing.eventDate;
      reconciled.title = incoming.title || existing.title;
      reconciled.occurrenceClass = incoming.occurrenceClass || existing.occurrenceClass;
      reconciled.confidenceScore = incomingRank;
      reconciled.lastVerified = new Date().toISOString();
    }

    // Always append new categories and keywords (multi-label support)
    if (incoming.occurrenceCategory) {
      const categories = new Set([...(existing.occurrenceCategory || []), ...incoming.occurrenceCategory]);
      reconciled.occurrenceCategory = Array.from(categories);
    }

    return reconciled;
  }

  /**
   * Detects discrepancies between an existing incident and a new report.
   * These are logged to the Governance Console.
   */
  public static detectDiscrepancies(existing: any, incoming: DetailedIncident) {
    const discrepancies = [];

    if (existing.eventDate && incoming.eventDate && existing.eventDate !== incoming.eventDate) {
      discrepancies.push({
        field: 'eventDate',
        existing: existing.eventDate,
        incoming: incoming.eventDate
      });
    }

    if (existing.aircraft && incoming.aircraft && existing.aircraft !== incoming.aircraft) {
      discrepancies.push({
        field: 'aircraft',
        existing: existing.aircraft,
        incoming: incoming.aircraft
      });
    }

    return discrepancies;
  }
}
