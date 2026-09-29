import {
  ValidationInput,
  ValidationContext,
  DSLRule,
  Authority,
  DroneModel,
  PermitNode,
  SpatialFeatureCollection,
  MatchedFeatureResult,
  RegulatoryCitation,
} from "../types";
import { GisEngine } from "../engines/gisEngine";
import { FlightEngine } from "../engines/flightEngine";
import { IntegrityValidator } from "../utils/integrity";

export class ApiLayer {
  private gisEngine = new GisEngine();
  private flightEngine: FlightEngine;

  private rules: DSLRule[] = [];
  private authorities: Authority[] = [];
  private drones: DroneModel[] = [];
  private permitNodes: PermitNode[] = [];
  private citations: RegulatoryCitation[] = [];
  private initialized = false;

  constructor() {
    this.flightEngine = new FlightEngine(this.gisEngine);
  }

  /**
   * Initializes and validates the database assets.
   */
  public initialize(
    drones: DroneModel[],
    rules: DSLRule[],
    authorities: Authority[],
    permitNodes: PermitNode[],
    geoLayers: { [layerName: string]: SpatialFeatureCollection },
    citations: RegulatoryCitation[]
  ): { success: boolean; errors: string[]; warnings: string[] } {
    // 1. Data Integrity checks
    const integrityReport = IntegrityValidator.validateDatabase(
      rules,
      authorities,
      drones,
      permitNodes,
      geoLayers,
      citations
    );

    if (!integrityReport.isValid) {
      return {
        success: false,
        errors: integrityReport.errors,
        warnings: integrityReport.warnings,
      };
    }

    this.drones = drones;
    this.rules = rules;
    this.authorities = authorities;
    this.permitNodes = permitNodes;
    this.citations = citations || [];

    // 2. Load layers into GIS spatial grid index
    this.gisEngine.clear();
    for (const [layerName, collection] of Object.entries(geoLayers)) {
      this.gisEngine.loadLayer(layerName, collection);
    }

    this.initialized = true;
    return {
      success: true,
      errors: [],
      warnings: integrityReport.warnings,
    };
  }

  /**
   * Main API endpoint to evaluate a proposed flight plan.
   */
  public async validateFlight(input: ValidationInput): Promise<ValidationContext> {
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
  public findNearbyRestrictions(
    latitude: number,
    longitude: number,
    radiusMeters = 15000
  ): MatchedFeatureResult[] {
    if (!this.initialized) {
      throw new Error("API Layer is not initialized.");
    }
    return this.gisEngine.queryLocation({ latitude, longitude }, radiusMeters);
  }

  /**
   * Resolves details for a registered drone.
   */
  public getDrone(manufacturer: string, model: string): DroneModel | undefined {
    return this.drones.find(
      (d) =>
        d.manufacturer.toLowerCase() === manufacturer.toLowerCase() &&
        d.model.toLowerCase() === model.toLowerCase()
    );
  }

  /**
   * Searches the database for matching names or keywords.
   */
  public searchEntities(query: string): any[] {
    const term = query.toLowerCase();
    const matches: any[] = [];

    // Search drones
    for (const drone of this.drones) {
      if (
        drone.manufacturer.toLowerCase().includes(term) ||
        drone.model.toLowerCase().includes(term)
      ) {
        matches.push({ type: "drone", entity: drone });
      }
    }

    // Search authorities
    for (const auth of this.authorities) {
      if (auth.name.toLowerCase().includes(term) || auth.role.toLowerCase().includes(term)) {
        matches.push({ type: "authority", entity: auth });
      }
    }

    // Search rules
    for (const rule of this.rules) {
      if (rule.name.toLowerCase().includes(term) || rule.result.reason.toLowerCase().includes(term)) {
        matches.push({ type: "rule", entity: rule });
      }
    }

    return matches;
  }
}
