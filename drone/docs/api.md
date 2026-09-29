# API Reference

This document specifies the programming interfaces exposed by `packages/core`.

## `ApiLayer` Class

The primary entry point for orchestrating evaluations and querying compliance databases.

### Methods

#### `initialize(drones, rules, authorities, permitNodes, geoLayers)`
Initializes the compliance database and runs data integrity validators.

* **Parameters**:
  - `drones`: `DroneModel[]` - Array of structural specifications.
  - `rules`: `DSLRule[]` - Dynamic regulation DSL parameters.
  - `authorities`: `Authority[]` - Consolidated agency directory.
  - `permitNodes`: `PermitNode[]` - Decision workflow routing graph.
  - `geoLayers`: `{ [layerName: string]: SpatialFeatureCollection }` - Mapped GeoJSON layers.
* **Returns**: `{ success: boolean; errors: string[]; warnings: string[] }`
  - Returns `success: false` and lists error reasons if validation checks or schemas fail.

#### `validateFlight(input)`
Evaluates a proposed flight profile against the indexed database and regulations.

* **Parameters**:
  - `input`: `ValidationInput`
* **Returns**: `Promise<ValidationContext>` - Full context result detailing status, matches, required permits, and explanations.

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
