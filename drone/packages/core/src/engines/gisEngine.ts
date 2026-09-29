import { SpatialFeatureCollection, Coordinate, MatchedFeatureResult } from "../types";
import { SpatialIndex } from "../utils/spatialIndex";
import { getDistanceToGeometry } from "../utils/geoUtils";

/**
 * Handles GeoJSON layer parsing, spatial index querying, and proximity calculations.
 */
export class GisEngine {
  private index = new SpatialIndex();
  private layersMetadata: Map<string, { layerName: string; priority: number }> = new Map();

  /**
   * Loads and indexes a GeoJSON spatial layer.
   */
  public loadLayer(layerName: string, collection: SpatialFeatureCollection): void {
    if (!collection || !Array.isArray(collection.features)) {
      return;
    }

    for (const feature of collection.features) {
      // Overwrite feature properties with layer priority if not set
      const props = feature.properties;
      props.category = props.category || layerName;
      this.index.insert(feature);
    }
  }

  /**
   * Resets the GIS index.
   */
  public clear(): void {
    this.index.clear();
  }

  /**
   * Performs spatial query at coordinate and returns sorted matching feature results.
   * Checks within a default buffer (e.g. 15 km) for nearby advisory warnings.
   */
  public queryLocation(point: Coordinate, searchRadiusMeters = 15000): MatchedFeatureResult[] {
    const candidates = this.index.search(point, searchRadiusMeters);
    const results: MatchedFeatureResult[] = [];

    for (const feature of candidates) {
      const props = feature.properties;
      const distance = getDistanceToGeometry(point, feature.geometry);

      // We match if the point falls inside the buffer distance of the restriction
      const buffer = props.bufferMeters || 0;
      
      // Feature is a match if either we are inside it (dist = 0) or distance is within its buffer
      if (distance <= buffer || distance === 0) {
        results.push({
          id: props.id,
          name: props.name,
          layer: props.category,
          distanceMeters: Math.round(distance * 100) / 100,
          confidence: props.dataQuality.confidence,
          restrictionType: props.restrictionType,
          priority: props.priority,
        });
      }
    }

    // Sort features by priority descending (higher priority overrides)
    return results.sort((a, b) => b.priority - a.priority);
  }
}
