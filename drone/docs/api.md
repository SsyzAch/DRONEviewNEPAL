# API Reference

This document specifies the programming interfaces exposed by `packages/core`.

## `ApiLayer` Class

The primary entry point for orchestrating evaluations and querying compliance databases.

### Methods

#### `initialize(drones, rules, authorities, permitNodes, geoLayers, citations)`
Initializes the compliance database and runs data integrity validators.

* **Parameters**:
  - `drones`: `DroneModel[]` - Array of structural specifications.
  - `rules`: `DSLRule[]` - Dynamic regulation DSL parameters.
  - `authorities`: `Authority[]` - Consolidated agency directory.
  - `permitNodes`: `PermitNode[]` - Decision workflow routing graph.
  - `geoLayers`: `{ [layerName: string]: SpatialFeatureCollection }` - Mapped GeoJSON layers.
  - `citations`: `RegulatoryCitation[]` - Authoritative legal source records mapped by `citationIds`.
* **Returns**: `{ success: boolean; errors: string[]; warnings: string[] }`
  - Returns `success: false` and lists error reasons if validation checks or schemas fail.

#### `validateFlight(input)`
Evaluates a proposed flight profile against the indexed database and regulations.

* **Parameters**:
  - `input`: `ValidationInput`
* **Returns**: `Promise<ValidationContext>` - Full context result detailing status, matches, required permits, and explanations.
  - `results.status`: One of `Allowed`, `Warning`, `Permit Required`, `Restricted`, `Prohibited`.
  - `results.citations`: Stable source-backed citation objects (`id`, `documentId`, `authorityName`, `legalBasis`, `officialCircular`, `section`, `page`, `quoteStart`, `quoteEnd`, `ocrConfidence`).

#### `findNearbyRestrictions(latitude, longitude, radiusMeters)`
Performs an spatial query at coordinates to locate overlapping or nearby buffers.

* **Parameters**:
  - `latitude`: `Number`
  - `longitude`: `Number`
  - `radiusMeters`: `Number` (default: `15000`)
* **Returns**: `MatchedFeatureResult[]` - Candidate buffers sorted by precedence priority.

#### `getDrone(manufacturer, model)`
Locates specifications for a registered drone system.

* **Parameters**:
  - `manufacturer`: `String`
  - `model`: `String`
* **Returns**: `DroneModel | undefined`
