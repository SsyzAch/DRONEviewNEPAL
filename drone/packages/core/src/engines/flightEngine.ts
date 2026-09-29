import {
  ValidationInput,
  ValidationContext,
  DSLRule,
  Authority,
  DroneModel,
  PermitNode,
  Coordinate,
  RegulatoryCitation,
} from "../types";
import { GisEngine } from "./gisEngine";
import { RuleEngine } from "./ruleEngine";
import { PermitEngine } from "./permitEngine";
import { RiskEngine } from "./riskEngine";
import { CitationEngine } from "./citationEngine";
import { ExplanationEngine } from "./explanationEngine";
import { EventSystem } from "../utils/eventSystem";

export class FlightEngine {
  private gisEngine: GisEngine;
  private ruleEngine: RuleEngine;
  private permitEngine: PermitEngine;
  private riskEngine: RiskEngine;
  private citationEngine: CitationEngine;
  private explanationEngine: ExplanationEngine;
  private eventSystem: EventSystem;

  constructor(gisEngine: GisEngine) {
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
  private registerPipeline(): void {
    // 1. After GIS lookup completes, evaluate dynamic rules
    this.eventSystem.on("GisLookupCompleted", async (context) => {
      // Rules are passed dynamically during evaluation
    });
  }

  /**
   * Evaluates a flight plan against regulations.
   */
  public async evaluateFlight(
    input: ValidationInput,
    rules: DSLRule[],
    authorities: Authority[],
    drones: DroneModel[],
    permitNodes: PermitNode[],
    citations: RegulatoryCitation[]
  ): Promise<ValidationContext> {
    const evaluationId = `eval-${Math.random().toString(36).substr(2, 9)}`;
    
    // Find matching drone specification details
    const droneSpec = drones.find(
      (d) =>
        d.manufacturer.toLowerCase() === input.drone.manufacturer.toLowerCase() &&
        d.model.toLowerCase() === input.drone.model.toLowerCase()
    );

    const resolvedTakeoffWeight =
      input.drone.takeoffWeightGrams ||
      input.drone.weightGrams ||
      (droneSpec ? droneSpec.takeoffWeightGrams : 500);
    const resolvedWeightGrams = Math.max(
      input.drone.weightGrams || 0,
      input.drone.takeoffWeightGrams || 0,
      droneSpec ? droneSpec.weightGrams : 0,
      resolvedTakeoffWeight
    );

    const context: ValidationContext = {
      id: evaluationId,
      timestamp: new Date().toISOString(),
      input: {
        flight: input.flight,
        drone: {
          manufacturer: input.drone.manufacturer,
          model: input.drone.model,
          weightGrams: resolvedWeightGrams,
          takeoffWeightGrams: resolvedTakeoffWeight,
        },
        pilot: input.pilot,
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
          overall: 0,
        },
      },
      provenance: {
        engineVersion: "1.0.0",
        rulesVersion: "v1",
        geoVersion: "v1",
      },
    };

    // Pipeline Step 1: Spatial database lookup
    const point: Coordinate = {
      latitude: input.flight.latitude,
      longitude: input.flight.longitude,
    };
    context.results.matchedFeatures = this.gisEngine.queryLocation(point);
    await this.eventSystem.emit("GisLookupCompleted", context);

    // Pipeline Step 2: Dynamic Rules Compilation
    this.ruleEngine.evaluateRules(context, rules);
    await this.eventSystem.emit("RulesEvaluated", context);

    // Pipeline Step 3: Multi-dimensional Safety and Legal Risk evaluation
    this.riskEngine.calculateRisk(context);
    await this.eventSystem.emit("RiskCalculated", context);

    // Pipeline Step 4: Decision graph walking for permit generation
    this.permitEngine.evaluatePermits(context, permitNodes);
    await this.eventSystem.emit("PermitGenerated", context);

    // Pipeline Step 5: Citation generation and natural language explanation
    this.citationEngine.compileCitations(context, authorities, citations);
    await this.eventSystem.emit("ExplanationGenerated", context);

    this.explanationEngine.generateExplanations(context);
    await this.eventSystem.emit("EvaluationFinished", context);

    return context;
  }
}
