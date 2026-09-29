import { ValidationContext } from "../types";

/**
 * Calculates multi-dimensional safety and operational risks.
 */
export class RiskEngine {
  /**
   * Evaluates the risk vectors and context confidence.
   */
  public calculateRisk(context: ValidationContext): void {
    const input = context.input;
    const matchedFeatures = context.results.matchedFeatures;

    // 1. Establish baseline risk metrics
    let safety = 10; // Baseline
    let legal = 10;
    let privacy = 10;
    let operational = 10;
    let environmental = 10;

    // Weight/Size adjustment
    const weight = input.drone.takeoffWeightGrams || 500;
    if (weight > 2000) {
      safety += 20;
      operational += 15;
    } else if (weight > 250) {
      safety += 5;
    }

    // Altitude risk
    const alt = input.flight.altitudeAgl;
    safety += Math.min(alt * 0.3, 40); // safety risk grows with altitude
    operational += Math.min(alt * 0.2, 30);

    // Purpose-based privacy risk
    if (input.pilot.purpose === "Commercial" || input.pilot.purpose === "Research") {
      privacy += 15;
    }

    // 2. Accumulate rule surcharges (pre-populated by ruleEngine)
    safety += context.results.risk.safety;
    legal += context.results.risk.legal;
    privacy += context.results.risk.privacy;
    operational += context.results.risk.operational;
    environmental += context.results.risk.environmental;

    // 3. Spatial buffer adjustments
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

    // Clamping values between 0 and 100
    context.results.risk.safety = Math.min(Math.max(safety, 0), 100);
    context.results.risk.legal = Math.min(Math.max(legal, 0), 100);
    context.results.risk.privacy = Math.min(Math.max(privacy, 0), 100);
    context.results.risk.operational = Math.min(Math.max(operational, 0), 100);
    context.results.risk.environmental = Math.min(Math.max(environmental, 0), 100);

    // Overall risk is weighted heaviest on legal and safety
    const overall =
      context.results.risk.safety * 0.3 +
      context.results.risk.legal * 0.3 +
      context.results.risk.privacy * 0.15 +
      context.results.risk.operational * 0.15 +
      context.results.risk.environmental * 0.1;

    context.results.risk.overall = Math.round(overall);

    // 4. Calculate Data Confidence Score
    let totalConfidence = 100;
    if (matchedFeatures.length > 0) {
      const sumConf = matchedFeatures.reduce((sum, f) => sum + f.confidence, 0);
      totalConfidence = sumConf / matchedFeatures.length;
    }

    // Apply penalty if any matched rule has lower spatial confidence or is missing data
    context.results.risk.overall = Math.min(100, context.results.risk.overall);
  }
}
