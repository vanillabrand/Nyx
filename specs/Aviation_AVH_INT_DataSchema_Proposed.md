# Core Data Structure - Flight Data Analyser

This document outlines the logical structure of the database, designed for precise auditing and fast lookup across large datasets. It is aligned with international reporting standards (ICAO Annex 13).

## 1. Graph Database Structure (Neo4j)

### Core Nodes
| Node | Properties | Standard Reference |
| :--- | :--- | :--- |
| **Incident** | `uuid`, `eventDate`, `title`, `occurrenceClass`, `occurrenceCategory`, `riskScore`, `flightPhase` | ICAO ADREP taxonomy. |
| **Aircraft** | `tailNumber`, `serialNumber`, `manufactureDate`, `massGroup`, `config` | Registration-level data. |
| **AircraftType** | `icaoCode`, `manufacturer`, `modelName`, `engineType`, `engineCount` | Aircraft designator lookup. |
| **Airline** | `icaoCode`, `name`, `country`, `operatorType` | Operator master list. |
| **Airport** | `icaoCode`, `iataCode`, `name`, `location (Point)` | Official airport database. |
| **MetarRecord** | `uuid`, `rawText`, `visibility`, `windSpeed`, `condition` | Weather data at time of event. |
| **GroundEntity** | `uuid`, `type`, `description` | Non-aircraft objects or wildlife. |

### Relationships (Mapping the Logic)
| Relationship | Logic | Purpose |
| :--- | :--- | :--- |
| `:INVOLVED_AIRCRAFT` | 1..N | Links one or more aircraft to a single event. |
| `:INVOLVED_OBJECT` | 1..N | For ground collisions or bird strikes. |
| `:DEPARTED_FROM` | 1..1 | Point of departure. |
| `:ARRIVED_AT` | 1..1 | Intended arrival point. |
| `:DIVERTED_TO` | 0..N | Sequential tracking of diversions. |
| `:HAS_CATEGORY` | 1..N | Categorising events by type (e.g. Engine, Fire). |
| `:SUPPORTED_BY` | 1..N | Direct link to the source material for auditing. |

---

## 2. Data Governance & Accuracy
- **Source Authority Ranking**:
    - **Official Final Reports**: Rank 1 (The primary truth).
    - **NTSB/FAA Data**: Rank 2.
    - **Aviation Herald / News**: Rank 3 (Used for initial alerts).
- **Discrepancy Resolution**: If two sources conflict on a date or tail number, the higher-ranked source automatically takes priority. All changes are logged for manual review.

## 3. Optimisation for Speed
- **Indexing**: All date fields and ICAO codes are indexed for immediate retrieval.
- **Pre-calculated Totals**: Safety metrics and incident counts are updated on the Airline and Aircraft nodes during the ingestion process, so the dashboard does not need to perform complex calculations on every load.
- **Geospatial Processing**: Airport distances and proximity queries use coordinate-based logic for accuracy.
