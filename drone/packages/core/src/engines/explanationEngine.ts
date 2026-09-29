import { ValidationContext } from "../types";

/**
 * Translates structured validation context findings into human-readable logical steps.
 */
export class ExplanationEngine {
  /**
   * Generates step-by-step logic trails for end-users to understand the flight compliance decisions.
   */
  public generateExplanations(context: ValidationContext): void {
    const explanations: string[] = [];
    const structuredExplanations: any[] = [];
    const status = context.results.status;

    // 1. Stage: Input
    structuredExplanations.push({
      stage: "Input",
      description: `Drone: ${context.input.drone.manufacturer} ${context.input.drone.model} (${context.input.drone.takeoffWeightGrams}g). Purpose: ${context.input.pilot.purpose}. Pilot: ${context.input.pilot.nationality}.`
    });

    explanations.push(`Flight Status: ${status}`);
    if (status === "Allowed") {
      explanations.push(
        "No major regulatory restrictions detected. The flight matches standard 'Open Category' parameters."
      );
    } else if (status === "Permit Required") {
      explanations.push(
        "Flight can proceed only after required agency permits are approved."
      );
    }

    // 2. Stage: SpatialMatch
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

    // 3. Stage: RuleMatch
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
      const citationSummary =
        rule.citationIds.length > 0 ? ` (citations: ${rule.citationIds.join(", ")})` : "";
      structuredExplanations.push({
        stage: "RuleMatch",
        targetId: rule.id,
        description: `Matched rule "${rule.ruleName}" with severity ${rule.severity}: ${rule.reason}${citationSummary}`
      });
    }

    // 4. Stage: ConflictResolution
    structuredExplanations.push({
      stage: "ConflictResolution",
      targetId: context.results.highestPriorityRule || undefined,
      description: `Conflict resolution: Final status set to "${status}" based on highest precedence matching rule.`
    });

    // 5. Stage: PermitRequirement
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

    // 6. Stage: Citation
    for (const citation of context.results.citations) {
      structuredExplanations.push({
        stage: "Citation",
        targetId: citation.id,
        description: `Legal Basis: ${citation.legalBasis} (${citation.officialCircular}), Authority: ${citation.authorityName}`
      });
    }

    // 7. Stage: RiskEvaluation
    const risk = context.results.risk;
    explanations.push(
      `Risk Analysis Summary: Overall Score is ${risk.overall}/100. Legal Risk: ${risk.legal}, Safety Risk: ${safetyLabel(risk.safety)} (${risk.safety}/100), Privacy Risk: ${risk.privacy}/100.`
    );

    structuredExplanations.push({
      stage: "RiskEvaluation",
      description: `Safety Score: ${risk.safety}, Legal Score: ${risk.legal}, Privacy Score: ${risk.privacy}, Operational Score: ${risk.operational}, Environmental Score: ${risk.environmental}. Overall weighted risk: ${risk.overall}/100.`
    });

    // 8. Stage: Decision
    structuredExplanations.push({
      stage: "Decision",
      description: `Final decision resolved to "${status}".`
    });

    context.results.explanations = explanations;
    context.results.structuredExplanations = structuredExplanations;
  }
}

function safetyLabel(score: number): string {
  if (score > 70) return "High";
  if (score > 40) return "Moderate";
  return "Low";
}
