# ADR 0002: Spatial Indexing Strategy

## Context and Problem
The system queries 26+ spatial layers (airports, parks, heritage sites, VVIP zones) to calculate proximity buffers. Iterating through all layers and features line-by-line (brute-force scan) is computationally expensive ($O(N)$) and could slow down evaluation requests.

## Considered Options
1. **Third-party Native C++ GIS Libraries (e.g. Node-GDAL, Proj4)**: High-performance geodetic libraries.
2. **Pure JS R-Tree / Spatial Libraries (e.g. RBush)**: Lightweight dependencies.
3. **Pure TypeScript Spatial Index**: Custom bounding-box partitioning QuadTree or Grid Index written from scratch.

## Decision and Rationale
We chose **Option 3 (Pure TypeScript Spatial Index)**. 
Using a custom bounding-box grid overlaps index ensures the engine operates on any environment (especially offline devices, mobile clients, and Windows hosts) without requiring native C++ compilers. Since the total features of interest for drone regulations are relatively small (hundreds), a 2D bounding-box filter is extremely fast (<1ms) and carries zero binary dependency risks.

## Consequences
- **Pros**: 100% portable, lightweight, fast, no native compile dependencies.
- **Cons**: Requires custom geodetic bounding-box calculations for point-buffer limits.
