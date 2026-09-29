import {
  DSLRule,
  Authority,
  DroneModel,
  PermitNode,
  SpatialFeatureCollection,
  RegulatoryCitation,
} from "../types";

export interface IntegrityReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates the schema and cross-references of the entire database.
 */
export class IntegrityValidator {
  /**
   * Performs complete data integrity checks.
   */
  public static validateDatabase(
    rules: DSLRule[],
    authorities: Authority[],
    drones: DroneModel[],
    permitNodes: PermitNode[],
    geoLayers: { [layerName: string]: SpatialFeatureCollection },
    citations: RegulatoryCitation[]
  ): IntegrityReport {
    const report: IntegrityReport = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const authorityIds = new Set(authorities.map((a) => a.id));
    const citationIds = new Set(citations.map((c) => c.id));
    const ruleIds = new Set<string>();
    const droneIds = new Set<string>();
    const allowedConditionFields = new Set([
      "distanceToAirport",
      "insideNationalPark",
      "insideHeritageSite",
      "insideMilitaryZone",
      "altitudeAgl",
      "pilot.nationality",
      "pilot.purpose",
      "drone.weightGrams",
      "drone.takeoffWeightGrams",
    ]);

    // 1. Validate Drones
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
      if (drone.takeoffWeightGrams <= 0) {
        report.errors.push(
          `Drone ${drone.id} has invalid takeoff weight: ${drone.takeoffWeightGrams}g`
        );
      }
      if (drone.takeoffWeightGrams < drone.weightGrams) {
        report.errors.push(
          `Drone ${drone.id} has takeoff weight lower than dry weight (${drone.takeoffWeightGrams} < ${drone.weightGrams})`
        );
      }
    }

    // 2. Validate Authorities
    for (const auth of authorities) {
      if (!auth.id) {
        report.errors.push(`Authority has missing ID: ${auth.name}`);
      }
    }

    // 3. Validate Rules
    const referencedAuthorityIds = new Set<string>();
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

      // Check referenced citations
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

      // Check conditions DSL structure
      if (!Array.isArray(rule.conditions)) {
        report.errors.push(`Rule ${rule.id} conditions must be an array`);
      } else {
        for (const cond of rule.conditions) {
          if (!cond.field || !cond.operator) {
            report.errors.push(`Rule ${rule.id} contains malformed condition`);
          } else if (!allowedConditionFields.has(cond.field)) {
            report.errors.push(`Rule ${rule.id} uses unsupported condition field: ${cond.field}`);
          }
        }
      }

      if (
        rule.metadata &&
        rule.metadata.effectiveDate &&
        rule.metadata.expiryDate &&
        new Date(rule.metadata.effectiveDate).getTime() > new Date(rule.metadata.expiryDate).getTime()
      ) {
        report.errors.push(`Rule ${rule.id} has expiryDate earlier than effectiveDate`);
      }

      if (!rule.metadata || rule.metadata.reviewStatus !== "Published") {
        report.warnings.push(`Rule ${rule.id} is not marked Published in metadata.reviewStatus`);
      }
    }

    // 4. Validate permit decision graph links
    const permitNodeIds = new Set(permitNodes.map((n) => n.id));
    for (const node of permitNodes) {
      if (!node.id) {
        report.errors.push("Permit graph contains node with missing ID");
        continue;
      }
      if (node.nextTrueNodeId && !permitNodeIds.has(node.nextTrueNodeId)) {
        report.errors.push(
          `Permit node ${node.id} references missing nextTrueNodeId: ${node.nextTrueNodeId}`
        );
      }
      if (node.nextFalseNodeId && !permitNodeIds.has(node.nextFalseNodeId)) {
        report.errors.push(
          `Permit node ${node.id} references missing nextFalseNodeId: ${node.nextFalseNodeId}`
        );
      }
    }

    // 5. Validate GeoJSON Layers
    for (const [layerName, layer] of Object.entries(geoLayers)) {
      if (!layer || layer.type !== "FeatureCollection" || !Array.isArray(layer.features)) {
        report.errors.push(`GeoJSON layer "${layerName}" is not a valid FeatureCollection`);
        continue;
      }

      const featureIds = new Set<string>();
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

        // Cross-reference authority
        if (props.authorityId) {
          referencedAuthorityIds.add(props.authorityId);
          if (!authorityIds.has(props.authorityId)) {
            report.errors.push(
              `Feature ${props.id} in layer "${layerName}" references non-existent authority: ${props.authorityId}`
            );
          }

          if (props.bufferMeters < 0) {
            report.errors.push(`Feature ${props.id} in layer "${layerName}" has negative bufferMeters`);
          }
          if (props.category && props.category !== layerName) {
            report.warnings.push(
              `Feature ${props.id} category "${props.category}" differs from loaded layer "${layerName}"`
            );
          }
        }
      }

      // 5b. Validate citations are unique and authority references are valid
      for (const citation of citations) {
        if (!citation.id) {
          report.errors.push("Citation has missing ID");
        }
        if (!authorityIds.has(citation.authorityId)) {
          report.errors.push(
            `Citation ${citation.id} references non-existent authority: ${citation.authorityId}`
          );
        }
        if (!citation.legalBasis || !citation.officialCircular) {
          report.errors.push(`Citation ${citation.id} is missing legalBasis or officialCircular`);
        }
      }
    }

    // 6. Detect Orphan Authorities (unused)
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
}
