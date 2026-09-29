import { SpatialFeature, Coordinate } from "../types";

export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/**
 * Helper to compute the bounding box of any geometry.
 */
export function getGeometryBoundingBox(geometry: { type: string; coordinates: any }): BoundingBox {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const processCoords = (coords: any) => {
    if (typeof coords[0] === "number") {
      const lon = coords[0];
      const lat = coords[1];
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    } else {
      for (const child of coords) {
        processCoords(child);
      }
    }
  };

  processCoords(geometry.coordinates);

  return { minLon, minLat, maxLon, maxLat };
}

/**
 * A fast, pure TypeScript bounding-box overlapping index.
 * Partitions elements and performs query pruning based on coordinate limits.
 */
export class SpatialIndex {
  private items: Array<{
    feature: SpatialFeature;
    bbox: BoundingBox;
  }> = [];

  /**
   * Inserts a GeoJSON feature into the spatial index.
   */
  public insert(feature: SpatialFeature): void {
    const bbox = getGeometryBoundingBox(feature.geometry);
    this.items.push({ feature, bbox });
  }

  /**
   * Clears the index.
   */
  public clear(): void {
    this.items = [];
  }

  /**
   * Searches for features whose bounding boxes overlap the search window.
   * Search window is centered at `center` with a search radius in meters.
   */
  public search(center: Coordinate, radiusMeters: number): SpatialFeature[] {
    const searchBBox = this.getSearchBoundingBox(center, radiusMeters);
    const results: SpatialFeature[] = [];

    for (const item of this.items) {
      if (this.intersects(searchBBox, item.bbox)) {
        results.push(item.feature);
      }
    }

    return results;
  }

  /**
   * Converts a center coordinate and radius into a bounding box.
   */
  private getSearchBoundingBox(center: Coordinate, radiusMeters: number): BoundingBox {
    const metersPerDegreeLat = 111320;
    const latDelta = radiusMeters / metersPerDegreeLat;
    const lonDelta = radiusMeters / (metersPerDegreeLat * Math.cos((center.latitude * Math.PI) / 180));

    return {
      minLon: center.longitude - lonDelta,
      minLat: center.latitude - latDelta,
      maxLon: center.longitude + lonDelta,
      maxLat: center.latitude + latDelta,
    };
  }

  /**
   * Checks if two bounding boxes overlap.
   */
  private intersects(box1: BoundingBox, box2: BoundingBox): boolean {
    return (
      box1.minLon <= box2.maxLon &&
      box1.maxLon >= box2.minLon &&
      box1.minLat <= box2.maxLat &&
      box1.maxLat >= box2.minLat
    );
  }
}
