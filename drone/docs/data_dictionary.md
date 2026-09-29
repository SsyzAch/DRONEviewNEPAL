# Data Dictionary

This document defines the schemas and property dictionaries utilized in the system.

## 1. Drone Specification Schema (`drones.json`)

Stores details for registered consumer drone systems.

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique identifier (e.g. `drone-nep-dji-mini4pro-001`) |
| `manufacturer` | String | Brand name |
| `model` | String | Model series name |
| `weightGrams` | Number | Dry structural weight in grams |
| `takeoffWeightGrams` | Number | Maximum takeoff gross weight including payload |
| `category` | String | Risk classes: `A` (<250g), `B` (250g-2kg), `C` (2kg-25kg), `D` (>25kg) |
| `registrationRequired` | Boolean | Registration flag |
| `insuranceRequired` | Boolean | Liability insurance flag |
| `licenseRequired` | Boolean | Remote pilot certification flag |
| `commercialAllowed` | Boolean | Commercial flight clearance flag |

---

## 2. Spatial Feature Schema

Properties attached to all GeoJSON features.

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique spatial ID (e.g. `feat-nep-tia-airport-001`) |
| `name` | String | Name of the location |
| `category` | String | Target layer category (e.g., `airports`, `national_parks`) |
| `authorityId` | String | Responsible agency ID |
| `restrictionType` | String | Operational constraint: `NoFly`, `Restricted`, `PermissionRequired`, `Advisory` |
| `bufferMeters` | Number | Buffer radius in meters |
| `priority` | Number | Precedence weighting (e.g., 100 for airports, 85 for parks) |
| `dataQuality` | Object | Verification flags: `verified` (boolean), `confidence` (0-100 score), `lastChecked` (date) |

---

## 3. DSL Rule Conditions Schema

Used in rules and permit decision nodes.

| Field | Type | Description |
|---|---|---|
| `field` | String | Context property path (e.g., `drone.weightGrams`, `distanceToAirport`, `altitudeAgl`) |
| `operator` | String | Comparison operator: `==`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not_in` |
| `value` | Any | Target value |
