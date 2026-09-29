"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // packages/core/src/utils/spatialIndex.ts
  function getGeometryBoundingBox(geometry) {
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    const processCoords = (coords) => {
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
  var SpatialIndex = class {
    constructor() {
      __publicField(this, "items", []);
    }
    /**
     * Inserts a GeoJSON feature into the spatial index.
     */
    insert(feature) {
      const bbox = getGeometryBoundingBox(feature.geometry);
      this.items.push({ feature, bbox });
    }
    /**
     * Clears the index.
     */
    clear() {
      this.items = [];
    }
    /**
     * Searches for features whose bounding boxes overlap the search window.
     * Search window is centered at `center` with a search radius in meters.
     */
    search(center, radiusMeters) {
      const searchBBox = this.getSearchBoundingBox(center, radiusMeters);
      const results = [];
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
    getSearchBoundingBox(center, radiusMeters) {
      const metersPerDegreeLat = 111320;
      const latDelta = radiusMeters / metersPerDegreeLat;
      const lonDelta = radiusMeters / (metersPerDegreeLat * Math.cos(center.latitude * Math.PI / 180));
      return {
        minLon: center.longitude - lonDelta,
        minLat: center.latitude - latDelta,
        maxLon: center.longitude + lonDelta,
        maxLat: center.latitude + latDelta
      };
    }
    /**
     * Checks if two bounding boxes overlap.
     */
    intersects(box1, box2) {
      return box1.minLon <= box2.maxLon && box1.maxLon >= box2.minLon && box1.minLat <= box2.maxLat && box1.maxLat >= box2.minLat;
    }
  };

  // packages/core/src/utils/geoUtils.ts
  function calculateHaversineDistance(coord1, coord2) {
    const R = 6371e3;
    const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    const lat1 = coord1.latitude * Math.PI / 180;
    const lat2 = coord2.latitude * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  function isPointInPolygon(point, polygonCoords) {
    const x = point.longitude;
    const y = point.latitude;
    let inside = false;
    const ring = polygonCoords[0];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const intersect = yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    if (inside && polygonCoords.length > 1) {
      for (let h = 1; h < polygonCoords.length; h++) {
        if (isPointInRing(point, polygonCoords[h])) {
          return false;
        }
      }
    }
    return inside;
  }
  function isPointInRing(point, ring) {
    const x = point.longitude;
    const y = point.latitude;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const intersect = yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
  function isPointInMultiPolygon(point, multiPolyCoords) {
    for (const polygon of multiPolyCoords) {
      if (isPointInPolygon(point, polygon)) {
        return true;
      }
    }
    return false;
  }
  function getDistanceToLineSegment(point, start, end) {
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
    let xx;
    let yy;
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
  function getDistanceToLineString(point, lineCoords) {
    let minDistance = Infinity;
    for (let i = 0; i < lineCoords.length - 1; i++) {
      const start = { longitude: lineCoords[i][0], latitude: lineCoords[i][1] };
      const end = { longitude: lineCoords[i + 1][0], latitude: lineCoords[i + 1][1] };
      const dist = getDistanceToLineSegment(point, start, end);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }
    return minDistance;
  }
  function getDistanceToPolygon(point, polygonCoords) {
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
  function getDistanceToMultiPolygon(point, multiPolyCoords) {
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
  function getDistanceToGeometry(point, geometry) {
    switch (geometry.type) {
      case "Point": {
        const coord = { longitude: geometry.coordinates[0], latitude: geometry.coordinates[1] };
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

  // packages/core/src/engines/gisEngine.ts
  var GisEngine = class {
    constructor() {
      __publicField(this, "index", new SpatialIndex());
      __publicField(this, "layersMetadata", /* @__PURE__ */ new Map());
    }
    /**
     * Loads and indexes a GeoJSON spatial layer.
     */
    loadLayer(layerName, collection) {
      if (!collection || !Array.isArray(collection.features)) {
        return;
      }
      for (const feature of collection.features) {
        const props = feature.properties;
        props.category = props.category || layerName;
        this.index.insert(feature);
      }
    }
    /**
     * Resets the GIS index.
     */
    clear() {
      this.index.clear();
    }
    /**
     * Performs spatial query at coordinate and returns sorted matching feature results.
     * Checks within a default buffer (e.g. 15 km) for nearby advisory warnings.
     */
    queryLocation(point, searchRadiusMeters = 15e3) {
      const candidates = this.index.search(point, searchRadiusMeters);
      const results = [];
      for (const feature of candidates) {
        const props = feature.properties;
        const distance = getDistanceToGeometry(point, feature.geometry);
        const buffer = props.bufferMeters || 0;
        if (distance <= buffer || distance === 0) {
          results.push({
            id: props.id,
            name: props.name,
            layer: props.category,
            distanceMeters: Math.round(distance * 100) / 100,
            confidence: props.dataQuality.confidence,
            restrictionType: props.restrictionType,
            priority: props.priority
          });
        }
      }
      return results.sort((a, b) => b.priority - a.priority);
    }
  };

  // packages/core/src/utils/temporalUtils.ts
  function isRestrictionActive(dateTimeIso, temporalConfig) {
    if (!temporalConfig) {
      return true;
    }
    const flightDate = new Date(dateTimeIso);
    if (isNaN(flightDate.getTime())) {
      throw new Error(`Invalid flight date-time format: ${dateTimeIso}`);
    }
    const ruleStart = new Date(temporalConfig.start);
    const ruleEnd = temporalConfig.end ? new Date(temporalConfig.end) : null;
    if (!temporalConfig.recurring) {
      if (flightDate < ruleStart) {
        return false;
      }
      if (ruleEnd && flightDate > ruleEnd) {
        return false;
      }
      return true;
    }
    if (flightDate < ruleStart) {
      return false;
    }
    if (ruleEnd && flightDate > ruleEnd) {
      return false;
    }
    const startHour = ruleStart.getUTCHours();
    const startMinute = ruleStart.getUTCMinutes();
    const endHour = ruleEnd ? ruleEnd.getUTCHours() : 23;
    const endMinute = ruleEnd ? ruleEnd.getUTCMinutes() : 59;
    const flightHour = flightDate.getUTCHours();
    const flightMinute = flightDate.getUTCMinutes();
    const flightTimeMins = flightHour * 60 + flightMinute;
    const startTimeMins = startHour * 60 + startMinute;
    const endTimeMins = endHour * 60 + endMinute;
    if (temporalConfig.recurring === "daily") {
      if (startTimeMins <= endTimeMins) {
        return flightTimeMins >= startTimeMins && flightTimeMins <= endTimeMins;
      } else {
        return flightTimeMins >= startTimeMins || flightTimeMins <= endTimeMins;
      }
    }
    if (temporalConfig.recurring === "weekly") {
      if (flightDate.getUTCDay() !== ruleStart.getUTCDay()) {
        return false;
      }
      return flightTimeMins >= startTimeMins && flightTimeMins <= endTimeMins;
    }
    if (temporalConfig.recurring === "monthly") {
      if (flightDate.getUTCDate() !== ruleStart.getUTCDate()) {
        return false;
      }
      return flightTimeMins >= startTimeMins && flightTimeMins <= endTimeMins;
    }
    if (temporalConfig.recurring === "yearly") {
      if (flightDate.getUTCMonth() !== ruleStart.getUTCMonth() || flightDate.getUTCDate() !== ruleStart.getUTCDate()) {
        return false;
      }
      return flightTimeMins >= startTimeMins && flightTimeMins <= endTimeMins;
    }
    return false;
  }

  // packages/core/src/engines/ruleEngine.ts
  function resolveValue(path, context) {
    if (path === "distanceToAirport") {
      const airport = context.results.matchedFeatures.find((f) => f.layer === "airports");
      return airport ? airport.distanceMeters : Infinity;
    }
    if (path === "insideNationalPark") {
      return context.results.matchedFeatures.some((f) => f.layer === "national_parks");
    }
    if (path === "insideHeritageSite") {
      return context.results.matchedFeatures.some((f) => f.layer === "heritage_sites");
    }
    if (path === "insideMilitaryZone") {
      return context.results.matchedFeatures.some((f) => f.layer === "military" || f.layer === "army");
    }
    if (path === "altitudeAgl") {
      return context.input.flight.altitudeAgl;
    }
    if (path === "pilot.nationality") {
      return context.input.pilot.nationality;
    }
    if (path === "pilot.purpose") {
      return context.input.pilot.purpose;
    }
    const parts = path.split(".");
    let current = context.input;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        return void 0;
      }
    }
    return current;
  }
  function evaluateCondition(condition, context) {
    const actualValue = resolveValue(condition.field, context);
    const expectedValue = condition.value;
    if (actualValue === void 0) {
      return false;
    }
    switch (condition.operator) {
      case "==":
        return actualValue === expectedValue;
      case "!=":
        return actualValue !== expectedValue;
      case "<":
        return actualValue < expectedValue;
      case "<=":
        return actualValue <= expectedValue;
      case ">":
        return actualValue > expectedValue;
      case ">=":
        return actualValue >= expectedValue;
      case "in":
        return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
      case "not_in":
        return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);
      default:
        return false;
    }
  }
  var RuleEngine = class {
    /**
     * Evaluates all versioned rules against the current ValidationContext.
     */
    evaluateRules(context, rules) {
      const flightTime = context.input.flight.dateTime;
      const matchedRules = [];
      for (const rule of rules) {
        if (!isRestrictionActive(flightTime, rule.temporal)) {
          continue;
        }
        let allSatisfied = true;
        for (const cond of rule.conditions) {
          if (!evaluateCondition(cond, context)) {
            allSatisfied = false;
            break;
          }
        }
        if (allSatisfied) {
          matchedRules.push({
            id: rule.id,
            ruleName: rule.name,
            severity: rule.result.status,
            reason: rule.result.reason,
            citationIds: rule.citationIds || []
          });
          const surcharges = rule.result.riskSurcharge;
          if (surcharges) {
            if (surcharges.legal) context.results.risk.legal += surcharges.legal;
            if (surcharges.safety) context.results.risk.safety += surcharges.safety;
            if (surcharges.privacy) context.results.risk.privacy += surcharges.privacy;
            if (surcharges.operational) context.results.risk.operational += surcharges.operational;
            if (surcharges.environmental) context.results.risk.environmental += surcharges.environmental;
          }
        }
      }
      context.results.matchedRules = matchedRules;
      const statusPrecedence = {
        Prohibited: 4,
        Restricted: 3,
        "Permit Required": 2,
        Warning: 1,
        Allowed: 0
      };
      let highestSeverity = "Allowed";
      let highestPriorityRuleId = null;
      let highestPriorityValue = -1;
      for (const match of matchedRules) {
        const currentSev = match.severity;
        const ruleDef = rules.find((r) => r.id === match.id);
        const priority = ruleDef ? ruleDef.priority : 0;
        if (statusPrecedence[currentSev] > statusPrecedence[highestSeverity]) {
          highestSeverity = currentSev;
          highestPriorityRuleId = match.id;
          highestPriorityValue = priority;
        } else if (statusPrecedence[currentSev] === statusPrecedence[highestSeverity]) {
          if (priority > highestPriorityValue) {
            highestPriorityRuleId = match.id;
            highestPriorityValue = priority;
          }
        }
      }
      context.results.status = highestSeverity;
      context.results.highestPriorityRule = highestPriorityRuleId;
    }
  };

  // packages/core/src/engines/permitEngine.ts
  var PermitEngine = class {
    /**
     * Evaluates the decision workflow starting from a root node (usually the first node in the array).
     */
    evaluatePermits(context, nodes) {
      if (nodes.length === 0) {
        return;
      }
      const nodeMap = /* @__PURE__ */ new Map();
      for (const node of nodes) {
        nodeMap.set(node.id, node);
      }
      let currentNode = nodes[0];
      const collectedPermits = /* @__PURE__ */ new Set();
      const evaluatedNodes = /* @__PURE__ */ new Set();
      while (currentNode) {
        if (evaluatedNodes.has(currentNode.id)) {
          break;
        }
        evaluatedNodes.add(currentNode.id);
        let criteriaMatched = true;
        for (const cond of currentNode.conditions) {
          if (!evaluateCondition(cond, context)) {
            criteriaMatched = false;
            break;
          }
        }
        let nextNodeId = null;
        if (criteriaMatched) {
          for (const permit of currentNode.requiredPermits) {
            collectedPermits.add(permit);
          }
          nextNodeId = currentNode.nextTrueNodeId;
        } else {
          nextNodeId = currentNode.nextFalseNodeId;
        }
        currentNode = nextNodeId ? nodeMap.get(nextNodeId) : void 0;
      }
      context.results.requiredPermits = Array.from(collectedPermits);
    }
  };

  // packages/core/src/engines/riskEngine.ts
  var RiskEngine = class {
    /**
     * Evaluates the risk vectors and context confidence.
     */
    calculateRisk(context) {
      const input = context.input;
      const matchedFeatures = context.results.matchedFeatures;
      let safety = 10;
      let legal = 10;
      let privacy = 10;
      let operational = 10;
      let environmental = 10;
      const weight = input.drone.takeoffWeightGrams || 500;
      if (weight > 2e3) {
        safety += 20;
        operational += 15;
      } else if (weight > 250) {
        safety += 5;
      }
      const alt = input.flight.altitudeAgl;
      safety += Math.min(alt * 0.3, 40);
      operational += Math.min(alt * 0.2, 30);
      if (input.pilot.purpose === "Commercial" || input.pilot.purpose === "Research") {
        privacy += 15;
      }
      safety += context.results.risk.safety;
      legal += context.results.risk.legal;
      privacy += context.results.risk.privacy;
      operational += context.results.risk.operational;
      environmental += context.results.risk.environmental;
      if (matchedFeatures.length > 0) {
        for (const feat of matchedFeatures) {
          if (feat.restrictionType === "NoFly") {
            legal += 40;
            safety += 25;
          } else if (feat.restrictionType === "Restricted") {
            legal += 25;
            safety += 15;
          } else if (feat.restrictionType === "PermissionRequired") {
            legal += 15;
          }
          if (feat.layer === "national_parks" || feat.layer === "conservation_areas") {
            environmental += 40;
          }
          if (feat.layer === "heritage_sites" || feat.layer === "religious_sites") {
            privacy += 20;
            legal += 20;
          }
        }
      }
      context.results.risk.safety = Math.min(Math.max(safety, 0), 100);
      context.results.risk.legal = Math.min(Math.max(legal, 0), 100);
      context.results.risk.privacy = Math.min(Math.max(privacy, 0), 100);
      context.results.risk.operational = Math.min(Math.max(operational, 0), 100);
      context.results.risk.environmental = Math.min(Math.max(environmental, 0), 100);
      const overall = context.results.risk.safety * 0.3 + context.results.risk.legal * 0.3 + context.results.risk.privacy * 0.15 + context.results.risk.operational * 0.15 + context.results.risk.environmental * 0.1;
      context.results.risk.overall = Math.round(overall);
      let totalConfidence = 100;
      if (matchedFeatures.length > 0) {
        const sumConf = matchedFeatures.reduce((sum, f) => sum + f.confidence, 0);
        totalConfidence = sumConf / matchedFeatures.length;
      }
      context.results.risk.overall = Math.min(100, context.results.risk.overall);
    }
  };

  // packages/core/src/engines/citationEngine.ts
  var CitationEngine = class {
    /**
     * Translates rule citations into human-readable legal basis descriptions.
     */
    compileCitations(context, authorities, citations) {
      const authMap = /* @__PURE__ */ new Map();
      for (const auth of authorities) {
        authMap.set(auth.id, auth);
      }
      const citationMap = /* @__PURE__ */ new Map();
      for (const cit of citations) {
        citationMap.set(cit.id, cit);
      }
      const uniqueCitations = /* @__PURE__ */ new Map();
      for (const matchedRule of context.results.matchedRules) {
        const ids = matchedRule.citationIds || [];
        for (const citId of ids) {
          const citation = citationMap.get(citId);
          if (!citation) {
            continue;
          }
          const authority = authMap.get(citation.authorityId);
          const authorityName = authority ? authority.name : citation.authorityId;
          const key = `${citation.authorityId}::${citation.legalBasis}`;
          if (!uniqueCitations.has(key)) {
            uniqueCitations.set(key, {
              id: key,
              authorityName,
              legalBasis: citation.legalBasis,
              officialCircular: citation.officialCircular,
              lastVerified: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
            });
          }
        }
      }
      context.results.citations = Array.from(uniqueCitations.values());
    }
  };

  // packages/core/src/engines/explanationEngine.ts
  var ExplanationEngine = class {
    /**
     * Generates step-by-step logic trails for end-users to understand the flight compliance decisions.
     */
    generateExplanations(context) {
      const explanations = [];
      const structuredExplanations = [];
      const status = context.results.status;
      structuredExplanations.push({
        stage: "Input",
        description: `Drone: ${context.input.drone.manufacturer} ${context.input.drone.model} (${context.input.drone.takeoffWeightGrams}g). Purpose: ${context.input.pilot.purpose}. Pilot: ${context.input.pilot.nationality}.`
      });
      explanations.push(`Flight Status: ${status}`);
      if (status === "Allowed") {
        explanations.push(
          "No major regulatory restrictions detected. The flight matches standard 'Open Category' parameters."
        );
      }
      const matchedFeatures = context.results.matchedFeatures;
      if (matchedFeatures.length > 0) {
        explanations.push("Spatial Proximity Alerts:");
        for (const feat of matchedFeatures) {
          explanations.push(
            `- Feature "${feat.name}" (Layer: ${feat.layer}) lies within buffer zone. Distance: ${feat.distanceMeters}m (Restriction: ${feat.restrictionType})`
          );
          structuredExplanations.push({
            stage: "SpatialMatch",
            targetId: feat.id,
            description: `Feature "${feat.name}" (Layer: ${feat.layer}) lies within buffer zone. Distance: ${feat.distanceMeters}m (Restriction: ${feat.restrictionType})`
          });
        }
      }
      const prohibitedRules = context.results.matchedRules.filter((r) => r.severity === "Prohibited");
      if (prohibitedRules.length > 0) {
        explanations.push("Prohibited Findings:");
        for (const rule of prohibitedRules) {
          explanations.push(
            `- BLOCKED: "${rule.ruleName}" because of matching conditions. Reason: ${rule.reason}`
          );
        }
      }
      const restrictedRules = context.results.matchedRules.filter((r) => r.severity === "Restricted");
      if (restrictedRules.length > 0) {
        explanations.push("Restriction & Permit Findings:");
        for (const rule of restrictedRules) {
          explanations.push(
            `- RESTRICTED: "${rule.ruleName}". Reason: ${rule.reason}`
          );
        }
      }
      for (const rule of context.results.matchedRules) {
        structuredExplanations.push({
          stage: "RuleMatch",
          targetId: rule.id,
          description: `Matched rule "${rule.ruleName}" with severity ${rule.severity}: ${rule.reason}`
        });
      }
      structuredExplanations.push({
        stage: "ConflictResolution",
        targetId: context.results.highestPriorityRule || void 0,
        description: `Conflict resolution: Final status set to "${status}" based on highest precedence matching rule.`
      });
      const permits = context.results.requiredPermits;
      if (permits.length > 0) {
        explanations.push(`Permits Required (${permits.length}):`);
        for (const permit of permits) {
          explanations.push(`- Acquire: ${permit}`);
          structuredExplanations.push({
            stage: "PermitRequirement",
            description: `Required permit: "${permit}"`
          });
        }
      }
      for (const citation of context.results.citations) {
        structuredExplanations.push({
          stage: "Citation",
          targetId: citation.id,
          description: `Legal Basis: ${citation.legalBasis} (${citation.officialCircular}), Authority: ${citation.authorityName}`
        });
      }
      const risk = context.results.risk;
      explanations.push(
        `Risk Analysis Summary: Overall Score is ${risk.overall}/100. Legal Risk: ${risk.legal}, Safety Risk: ${safetyLabel(risk.safety)} (${risk.safety}/100), Privacy Risk: ${risk.privacy}/100.`
      );
      structuredExplanations.push({
        stage: "RiskEvaluation",
        description: `Safety Score: ${risk.safety}, Legal Score: ${risk.legal}, Privacy Score: ${risk.privacy}, Operational Score: ${risk.operational}, Environmental Score: ${risk.environmental}. Overall weighted risk: ${risk.overall}/100.`
      });
      structuredExplanations.push({
        stage: "Decision",
        description: `Final decision resolved to "${status}".`
      });
      context.results.explanations = explanations;
      context.results.structuredExplanations = structuredExplanations;
    }
  };
  function safetyLabel(score) {
    if (score > 70) return "High";
    if (score > 40) return "Moderate";
    return "Low";
  }

  // packages/core/src/utils/eventSystem.ts
  var EventSystem = class {
    constructor() {
      __publicField(this, "listeners", /* @__PURE__ */ new Map());
    }
    /**
     * Registers a listener for an event type.
     */
    on(event, handler) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(handler);
    }
    /**
     * Emits an event, executing all registered handlers in sequence.
     */
    async emit(event, context) {
      const handlers = this.listeners.get(event) || [];
      for (const handler of handlers) {
        try {
          await handler(context);
        } catch (err) {
          console.error(`Error in event handler for event "${event}":`, err);
          context.results.explanations.push(`System error in event ${event}: ${err.message}`);
        }
      }
    }
  };

  // packages/core/src/engines/flightEngine.ts
  var FlightEngine = class {
    constructor(gisEngine) {
      __publicField(this, "gisEngine");
      __publicField(this, "ruleEngine");
      __publicField(this, "permitEngine");
      __publicField(this, "riskEngine");
      __publicField(this, "citationEngine");
      __publicField(this, "explanationEngine");
      __publicField(this, "eventSystem");
      this.gisEngine = gisEngine;
      this.ruleEngine = new RuleEngine();
      this.permitEngine = new PermitEngine();
      this.riskEngine = new RiskEngine();
      this.citationEngine = new CitationEngine();
      this.explanationEngine = new ExplanationEngine();
      this.eventSystem = new EventSystem();
      this.registerPipeline();
    }
    /**
     * Registers event sequence handlers.
     */
    registerPipeline() {
      this.eventSystem.on("GisLookupCompleted", async (context) => {
      });
    }
    /**
     * Evaluates a flight plan against regulations.
     */
    async evaluateFlight(input, rules, authorities, drones, permitNodes, citations) {
      const evaluationId = `eval-${Math.random().toString(36).substr(2, 9)}`;
      const droneSpec = drones.find(
        (d) => d.manufacturer.toLowerCase() === input.drone.manufacturer.toLowerCase() && d.model.toLowerCase() === input.drone.model.toLowerCase()
      );
      const mergedTakeoffWeight = input.drone.takeoffWeightGrams || (droneSpec ? droneSpec.takeoffWeightGrams : 500);
      const context = {
        id: evaluationId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        input: {
          flight: input.flight,
          drone: {
            manufacturer: input.drone.manufacturer,
            model: input.drone.model,
            takeoffWeightGrams: mergedTakeoffWeight
          },
          pilot: input.pilot
        },
        results: {
          status: "Allowed",
          highestPriorityRule: null,
          matchedFeatures: [],
          matchedRules: [],
          requiredPermits: [],
          citations: [],
          explanations: [],
          structuredExplanations: [],
          risk: {
            legal: 0,
            safety: 0,
            privacy: 0,
            operational: 0,
            environmental: 0,
            overall: 0
          }
        },
        provenance: {
          engineVersion: "1.0.0",
          rulesVersion: "v1",
          geoVersion: "v1"
        }
      };
      const point = {
        latitude: input.flight.latitude,
        longitude: input.flight.longitude
      };
      context.results.matchedFeatures = this.gisEngine.queryLocation(point);
      await this.eventSystem.emit("GisLookupCompleted", context);
      this.ruleEngine.evaluateRules(context, rules);
      await this.eventSystem.emit("RulesEvaluated", context);
      this.riskEngine.calculateRisk(context);
      await this.eventSystem.emit("RiskCalculated", context);
      this.permitEngine.evaluatePermits(context, permitNodes);
      await this.eventSystem.emit("PermitGenerated", context);
      this.citationEngine.compileCitations(context, authorities, citations);
      await this.eventSystem.emit("ExplanationGenerated", context);
      this.explanationEngine.generateExplanations(context);
      await this.eventSystem.emit("EvaluationFinished", context);
      return context;
    }
  };

  // packages/core/src/utils/integrity.ts
  var IntegrityValidator = class {
    /**
     * Performs complete data integrity checks.
     */
    static validateDatabase(rules, authorities, drones, geoLayers, citations) {
      const report = {
        isValid: true,
        errors: [],
        warnings: []
      };
      const authorityIds = new Set(authorities.map((a) => a.id));
      const citationIds = new Set(citations.map((c) => c.id));
      const ruleIds = /* @__PURE__ */ new Set();
      const droneIds = /* @__PURE__ */ new Set();
      for (const drone of drones) {
        if (!drone.id) {
          report.errors.push(`Drone has missing ID: ${drone.manufacturer} ${drone.model}`);
        } else if (droneIds.has(drone.id)) {
          report.errors.push(`Duplicate drone ID found: ${drone.id}`);
        } else {
          droneIds.add(drone.id);
        }
        if (drone.weightGrams <= 0) {
          report.errors.push(`Drone ${drone.id} has invalid weight: ${drone.weightGrams}g`);
        }
      }
      for (const auth of authorities) {
        if (!auth.id) {
          report.errors.push(`Authority has missing ID: ${auth.name}`);
        }
      }
      const referencedAuthorityIds = /* @__PURE__ */ new Set();
      for (const rule of rules) {
        if (!rule.id) {
          report.errors.push(`Rule has missing ID: ${rule.name}`);
          continue;
        }
        if (ruleIds.has(rule.id)) {
          report.errors.push(`Duplicate rule ID found: ${rule.id}`);
        } else {
          ruleIds.add(rule.id);
        }
        if (!Array.isArray(rule.citationIds)) {
          report.errors.push(`Rule ${rule.id} citationIds must be an array`);
        } else {
          for (const citId of rule.citationIds) {
            if (!citationIds.has(citId)) {
              report.errors.push(`Rule ${rule.id} references non-existent citation: ${citId}`);
            } else {
              const cit = citations.find((c) => c.id === citId);
              if (cit) {
                referencedAuthorityIds.add(cit.authorityId);
                if (!authorityIds.has(cit.authorityId)) {
                  report.errors.push(
                    `Citation ${citId} references non-existent authority: ${cit.authorityId}`
                  );
                }
              }
            }
          }
        }
        if (!Array.isArray(rule.conditions)) {
          report.errors.push(`Rule ${rule.id} conditions must be an array`);
        } else {
          for (const cond of rule.conditions) {
            if (!cond.field || !cond.operator) {
              report.errors.push(`Rule ${rule.id} contains malformed condition`);
            }
          }
        }
      }
      for (const [layerName, layer] of Object.entries(geoLayers)) {
        if (!layer || layer.type !== "FeatureCollection" || !Array.isArray(layer.features)) {
          report.errors.push(`GeoJSON layer "${layerName}" is not a valid FeatureCollection`);
          continue;
        }
        const featureIds = /* @__PURE__ */ new Set();
        for (const feature of layer.features) {
          if (feature.type !== "Feature" || !feature.geometry || !feature.properties) {
            report.errors.push(`Layer "${layerName}" contains malformed GeoJSON Feature`);
            continue;
          }
          const props = feature.properties;
          if (!props.id) {
            report.errors.push(`Layer "${layerName}" contains feature with missing ID`);
          } else if (featureIds.has(props.id)) {
            report.errors.push(`Layer "${layerName}" contains duplicate feature ID: ${props.id}`);
          } else {
            featureIds.add(props.id);
          }
          if (props.authorityId) {
            referencedAuthorityIds.add(props.authorityId);
            if (!authorityIds.has(props.authorityId)) {
              report.errors.push(
                `Feature ${props.id} in layer "${layerName}" references non-existent authority: ${props.authorityId}`
              );
            }
          }
        }
      }
      for (const authId of authorityIds) {
        if (!referencedAuthorityIds.has(authId)) {
          report.warnings.push(
            `Orphan authority found (not referenced by any citation or spatial feature): ${authId}`
          );
        }
      }
      report.isValid = report.errors.length === 0;
      return report;
    }
  };

  // packages/core/src/api/apiLayer.ts
  var ApiLayer = class {
    constructor() {
      __publicField(this, "gisEngine", new GisEngine());
      __publicField(this, "flightEngine");
      __publicField(this, "rules", []);
      __publicField(this, "authorities", []);
      __publicField(this, "drones", []);
      __publicField(this, "permitNodes", []);
      __publicField(this, "citations", []);
      __publicField(this, "initialized", false);
      this.flightEngine = new FlightEngine(this.gisEngine);
    }
    /**
     * Initializes and validates the database assets.
     */
    initialize(drones, rules, authorities, permitNodes, geoLayers, citations) {
      const integrityReport = IntegrityValidator.validateDatabase(
        rules,
        authorities,
        drones,
        geoLayers,
        citations
      );
      if (!integrityReport.isValid) {
        return {
          success: false,
          errors: integrityReport.errors,
          warnings: integrityReport.warnings
        };
      }
      this.drones = drones;
      this.rules = rules;
      this.authorities = authorities;
      this.permitNodes = permitNodes;
      this.citations = citations || [];
      this.gisEngine.clear();
      for (const [layerName, collection] of Object.entries(geoLayers)) {
        this.gisEngine.loadLayer(layerName, collection);
      }
      this.initialized = true;
      return {
        success: true,
        errors: [],
        warnings: integrityReport.warnings
      };
    }
    /**
     * Main API endpoint to evaluate a proposed flight plan.
     */
    async validateFlight(input) {
      if (!this.initialized) {
        throw new Error("API Layer is not initialized. Call initialize() first.");
      }
      return this.flightEngine.evaluateFlight(
        input,
        this.rules,
        this.authorities,
        this.drones,
        this.permitNodes,
        this.citations
      );
    }
    /**
     * Query nearby spatial zones and restrictions.
     */
    findNearbyRestrictions(latitude, longitude, radiusMeters = 15e3) {
      if (!this.initialized) {
        throw new Error("API Layer is not initialized.");
      }
      return this.gisEngine.queryLocation({ latitude, longitude }, radiusMeters);
    }
    /**
     * Resolves details for a registered drone.
     */
    getDrone(manufacturer, model) {
      return this.drones.find(
        (d) => d.manufacturer.toLowerCase() === manufacturer.toLowerCase() && d.model.toLowerCase() === model.toLowerCase()
      );
    }
    /**
     * Searches the database for matching names or keywords.
     */
    searchEntities(query) {
      const term = query.toLowerCase();
      const matches = [];
      for (const drone of this.drones) {
        if (drone.manufacturer.toLowerCase().includes(term) || drone.model.toLowerCase().includes(term)) {
          matches.push({ type: "drone", entity: drone });
        }
      }
      for (const auth of this.authorities) {
        if (auth.name.toLowerCase().includes(term) || auth.role.toLowerCase().includes(term)) {
          matches.push({ type: "authority", entity: auth });
        }
      }
      for (const rule of this.rules) {
        if (rule.name.toLowerCase().includes(term) || rule.result.reason.toLowerCase().includes(term)) {
          matches.push({ type: "rule", entity: rule });
        }
      }
      return matches;
    }
  };

  // packages/core/src/browserEntry.ts
  window.DroneComplianceApi = ApiLayer;
})();
