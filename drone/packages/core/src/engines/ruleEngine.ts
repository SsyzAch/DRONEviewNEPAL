import { DSLRule, DSLCondition, ValidationContext, MatchedRuleResult, ValidationStatus } from "../types";
import { isRestrictionActive } from "../utils/temporalUtils";

/**
 * Resolves nested paths in objects (e.g., "drone.weightGrams" -> object.drone.weightGrams).
 */
export function resolveValue(path: string, context: ValidationContext): any {
  // Direct shortcuts for spatial properties that rules frequently query
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

  // Nested property lookup
  const parts = path.split(".");
  let current: any = context.input;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Evaluates a single DSL condition against the validation context without calling eval().
 */
export function evaluateCondition(condition: DSLCondition, context: ValidationContext): boolean {
  const actualValue = resolveValue(condition.field, context);
  const expectedValue = condition.value;

  if (actualValue === undefined) {
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

/**
 * Core dynamic rules compiler and evaluator.
 */
export class RuleEngine {
  /**
   * Evaluates all versioned rules against the current ValidationContext.
   */
  public evaluateRules(context: ValidationContext, rules: DSLRule[]): void {
    const flightTime = context.input.flight.dateTime;
    const matchedRules: MatchedRuleResult[] = [];

    // Filter rules that are temporally active and satisfy all conditions
    for (const rule of rules) {
      // 1. Check temporal bounds
      if (!isRestrictionActive(flightTime, rule.temporal)) {
        continue;
      }

      // 2. Evaluate all conditions (AND logic)
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
          citationIds: rule.citationIds || [],
        });

        // Apply risk surcharges defined in rule
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

    // Resolve final status using deterministic severity precedence:
    // Prohibited > Restricted > Permit Required > Warning > Allowed
    const statusPrecedence: Record<ValidationStatus, number> = {
      Prohibited: 4,
      Restricted: 3,
      "Permit Required": 2,
      Warning: 1,
      Allowed: 0,
    };

    let highestSeverity: ValidationStatus = "Allowed";
    let highestPriorityRuleId: string | null = null;
    let highestPriorityValue = -1;

    // Find highest severity and map rule
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
}
