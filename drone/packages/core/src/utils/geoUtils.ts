export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Calculates the geodetic distance between two coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateHaversineDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
  const lat1 = (coord1.latitude * Math.PI) / 180;
  const lat2 = (coord2.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Checks if a point is inside a polygon using the Ray-Casting algorithm.
 * Coordinates are represented as [longitude, latitude].
 */
export function isPointInPolygon(point: Coordinate, polygonCoords: number[][][]): boolean {
  const x = point.longitude;
  const y = point.latitude;
  let inside = false;

  // Assumes first ring is the exterior boundary, subsequent rings are holes (we evaluate only exterior for simplicity, or loops)
  const ring = polygonCoords[0];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  // If inside the exterior, check if inside any holes
  if (inside && polygonCoords.length > 1) {
    for (let h = 1; h < polygonCoords.length; h++) {
      if (isPointInRing(point, polygonCoords[h])) {
        // If inside a hole, then it is NOT inside the polygon
        return false;
      }
    }
  }

  return inside;
}

function isPointInRing(point: Coordinate, ring: number[][]): boolean {
  const x = point.longitude;
  const y = point.latitude;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Checks if a point is inside a MultiPolygon.
 */
export function isPointInMultiPolygon(point: Coordinate, multiPolyCoords: number[][][][]): boolean {
  for (const polygon of multiPolyCoords) {
    if (isPointInPolygon(point, polygon)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the distance from a point to a line segment in meters.
 */
export function getDistanceToLineSegment(point: Coordinate, start: Coordinate, end: Coordinate): number {
  // Simple projection on segment in Cartesian approximation (sufficient for small distances)
  const x = point.longitude;
  const y = point.latitude;
  const x1 = start.longitude;
  const y1 = start.latitude;
  const x2 = end.longitude;
  const y2 = end.latitude;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number;
  let yy: number;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  return calculateHaversineDistance(point, { latitude: yy, longitude: xx });
}

/**
 * Returns the minimum distance from a point to a line string (represented as array of [longitude, latitude]).
 */
export function getDistanceToLineString(point: Coordinate, lineCoords: number[][]): number {
  let minDistance = Infinity;
  for (let i = 0; i < lineCoords.length - 1; i++) {
    const start: Coordinate = { longitude: lineCoords[i][0], latitude: lineCoords[i][1] };
    const end: Coordinate = { longitude: lineCoords[i + 1][0], latitude: lineCoords[i + 1][1] };
    const dist = getDistanceToLineSegment(point, start, end);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

/**
 * Returns the minimum distance from a point to a polygon boundary in meters.
 * If the point is inside the polygon, returns 0.
 */
export function getDistanceToPolygon(point: Coordinate, polygonCoords: number[][][]): number {
  if (isPointInPolygon(point, polygonCoords)) {
    return 0;
  }

  let minDistance = Infinity;
  for (const ring of polygonCoords) {
    const dist = getDistanceToLineString(point, ring);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

/**
 * Returns the minimum distance from a point to a MultiPolygon in meters.
 * If the point is inside, returns 0.
 */
export function getDistanceToMultiPolygon(point: Coordinate, multiPolyCoords: number[][][][]): number {
  if (isPointInMultiPolygon(point, multiPolyCoords)) {
    return 0;
  }

  let minDistance = Infinity;
  for (const polygon of multiPolyCoords) {
    const dist = getDistanceToPolygon(point, polygon);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

/**
 * General function to calculate the minimum distance from a point to any geometry.
 */
export function getDistanceToGeometry(point: Coordinate, geometry: { type: string; coordinates: any }): number {
  switch (geometry.type) {
    case "Point": {
      const coord: Coordinate = { longitude: geometry.coordinates[0], latitude: geometry.coordinates[1] };
      return calculateHaversineDistance(point, coord);
    }
    case "LineString":
      return getDistanceToLineString(point, geometry.coordinates);
    case "Polygon":
      return getDistanceToPolygon(point, geometry.coordinates);
    case "MultiPolygon":
      return getDistanceToMultiPolygon(point, geometry.coordinates);
    default:
      throw new Error(`Unsupported geometry type: ${geometry.type}`);
  }
}
