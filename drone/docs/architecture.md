# System Architecture - Drone Flight Compliance System

This document outlines the architecture of the compliance validation system.

## Layered Design & Modular Structure

The codebase is split into two packages:
1. **`packages/core`**: Contained compliance engines, utilities, and schema definitions. It is entirely country-agnostic.
2. **`packages/country-nepal`**: Contains Nepalese-specific regulations, GeoJSON geospatial layers, and permit graphs.

```
                  ┌──────────────────────────────┐
                  │          API Layer           │
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼───────────────┐
                  │    FlightEngine Pipeline     │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────┬───────┼───────────────┬───────────────┐
         │               │       │               │               │
  ┌──────▼──────┐ ┌──────▼──────┐│┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐
  │  GisEngine  │ │ RuleEngine  │││PermitEngine ││ RiskEngine  ││CitationEng  │
  └─────────────┘ └─────────────┘│└─────────────┘└─────────────┘└─────────────┘
                                 ▼
                    ┌──────────────────────────┐
                    │    ExplanationEngine     │
                    └──────────────────────────┘
```

---

## The Pipeline & Validation Context

The pipeline runs sequentially by passing a single `ValidationContext` across engines. Decoupling is managed by an internal `EventSystem`.

### Evaluation Sequence
1. **GisLookupCompleted**: The `GisEngine` queries layers from `geo/restrictions/` and `geo/base/` using a spatial bounding box index.
2. **RulesEvaluated**: The `RuleEngine` evaluates dynamic condition rules (defined in dynamic DSL format) against context parameters and spatial proximity variables.
3. **RiskCalculated**: The `RiskEngine` computes independent risk scores (Legal, Safety, Privacy, Operational, Environmental) and applies surcharges.
4. **PermitGenerated**: The `PermitEngine` traverses the directed decision graph (`workflow_graph.json`) to determine the list of agency permits required.
5. **ExplanationGenerated / EvaluationFinished**: The `CitationEngine` formats and deduplicates citations. The `ExplanationEngine` generates natural language steps of the process for trust and traceability.
