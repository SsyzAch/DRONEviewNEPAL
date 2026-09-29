# Developer Guide

This document describes how to extend and maintain the drone flight compliance database and engines.

## 1. Running Tests and Verification

A central validation script runs the scenario test suite:

```bash
node scripts/verify.js
```

This compiles and runs TypeScript tests using an isolated CommonJS transpiler.

---

## 2. Adding a New Drone Model

Drone model specifications are registered inside `drones/drones.json`. To add a model:
1. Append an object to the array.
2. Ensure you specify all required fields from the `DroneModel` schema:
   - `id`: Unique UUID starting with `drone-nep-`
   - `weightGrams`: Dry structure weight
   - `takeoffWeightGrams`: Gross weight (including max payload)
   - `category`: `A` (<250g), `B` (250g-2kg), `C` (2kg-25kg), `D` (>25kg)

---

## 3. Creating a New Regulation Rule

Rules are parsed dynamically from the `rules/*.json` database. To write a rule:
1. Define condition criteria using the DSL operator mapping:
   - Operators: `==`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not_in`.
   - Fields: `distanceToAirport`, `altitudeAgl`, `insideNationalPark`, `insideHeritageSite`, `drone.weightGrams`, `pilot.nationality`, etc.
2. Connect it traceably by providing a legal citation and authority ID.

Example:
```json
{
  "id": "rule-nep-custom-rule",
  "name": "Custom Limit",
  "priority": 75,
  "conditions": [
    {
      "field": "altitudeAgl",
      "operator": ">",
      "value": 120
    }
  ],
  "result": {
    "status": "Prohibited",
    "reason": "Exceeds absolute local height caps."
  },
  "citation": {
    "authorityId": "auth-nep-caan-001",
    "legalBasis": "UASR Section X",
    "officialCircular": "UASR 2021",
    "lastVerified": "2026-06-30"
  }
}
```

---

## 4. International Expansion (Adding a New Country)

The architecture is explicitly designed to handle multiple countries:
1. Create a staging directory under `/packages/country-<name>/data/v1/`.
2. Add modular files matching the layout:
   - `geo/restrictions/` and `geo/base/`
   - `rules/v1.json`
   - `permits/workflow_graph.json`
   - `metadata/authorities.json`
3. Instantiating the core `ApiLayer` with these assets configures the validation pipeline for that country.
