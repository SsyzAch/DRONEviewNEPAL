export interface Coordinate {
  latitude: number;
  longitude: number;
}

export type ValidationStatus =
  | "Allowed"
  | "Warning"
  | "Permit Required"
  | "Restricted"
  | "Prohibited";

export type Operator = "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "not_in";

export interface DSLCondition {
  field: string;      // e.g., "distanceToAirport", "altitudeAgl", "drone.weightGrams"
  operator: Operator;
  value: any;
}

export interface DSLRule {
  id: string; // e.g., rule-nep-airport-buffer-001
  name: string;
  priority: number; // For evaluation precedence
  conditions: DSLCondition[];
  result: {
    status: ValidationStatus;
    reason: string;
    riskSurcharge: {
      legal?: number;
      safety?: number;
      privacy?: number;
      operational?: number;
      environmental?: number;
    };
  };
  citationIds: string[];
  temporal?: {
    start: string;            // ISO UTC or "NOTAM_TRIGGER"
    end: string | null;
    timezone: string;
    recurring?: "daily" | "weekly" | "monthly" | "yearly" | null;
  };
  metadata: {
    reviewStatus?: "Extracted" | "Parsed" | "Reviewed" | "Verified" | "Published" | "Deprecated";
    effectiveDate: string;
    expiryDate: string | null;
    revision: number;
    supersedesId: string | null;
  };
}

export interface RegulatoryCitation {
  id: string; // e.g. cit-nep-caan-uasr-2021-sec101-7
  documentId: string;
  version: string;
  article: string | null;
  section: string;
  subsection: string | null;
  clause: string | null;
  paragraph: string | null;
  page: number;
  quoteStart: string;
  quoteEnd: string;
  ocrConfidence: number;
  authorityId: string;
  legalBasis: string;
  officialCircular: string;
}

export interface DroneModel {
  id: string; // e.g. drone-dji-mini4pro
  manufacturer: string;
  model: string;
  weightGrams: number;
  maxAltitudeMeters: number;
  hasCamera: boolean;
  takeoffWeightGrams: number;
  category: "A" | "B" | "C" | "D";
  registrationRequired: boolean;
  insuranceRequired: boolean;
  licenseRequired: boolean;
  commercialAllowed: boolean;
  remoteIdSupport: boolean;
  batteryType: string;
  firmwareVersion: string;
}

export interface Authority {
  id: string; // e.g., auth-nep-caan-001
  name: string;
  level: "Federal" | "Provincial" | "Local" | "Customs";
  role: string;
  website: string;
}

export interface DataQuality {
  verified: boolean;
  confidence: number; // 0 - 100
  lastChecked: string; // YYYY-MM-DD
  needsManualReview: boolean;
}

export interface SpatialFeatureProperties {
  id: string; // Unique spatial feature UUID/key
  name: string;
  category: string; // e.g., "airport_buffer", "national_park"
  authorityId: string;
  sourceDocument: string;
  effectiveDate: string;
  expires: string | null;
  restrictionType: "NoFly" | "Restricted" | "PermissionRequired" | "Advisory";
  bufferMeters: number;
  priority: number;
  dataQuality: DataQuality;
}

export interface SpatialFeature {
  type: "Feature";
  geometry: {
    type: "Point" | "LineString" | "Polygon" | "MultiPolygon";
    coordinates: any;
  };
  properties: SpatialFeatureProperties;
}

export interface SpatialFeatureCollection {
  type: "FeatureCollection";
  features: SpatialFeature[];
}

export interface LayerMetadata {
  layerName: string;
  source: string;
  downloadDate: string;
  checksum: string;
  version: string;
  license: string;
  maintainer: string;
  updateFrequency: string;
}

export interface PermitNode {
  id: string; // e.g., permit-node-commercial-001
  description: string;
  conditions: DSLCondition[];
  nextTrueNodeId: string | null;
  nextFalseNodeId: string | null;
  requiredPermits: string[];
  governingAuthorityIds: string[];
}

export interface ValidationInput {
  flight: {
    latitude: number;
    longitude: number;
    altitudeAgl: number;
    dateTime: string; // ISO UTC
  };
  drone: {
    manufacturer: string;
    model: string;
    weightGrams?: number;
    takeoffWeightGrams?: number;
  };
  pilot: {
    nationality: "Nepali" | "Foreign";
    purpose: "Recreational" | "Commercial" | "Research" | "Emergency";
  };
}

export interface MatchedFeatureResult {
  id: string;
  name: string;
  layer: string;
  distanceMeters: number;
  confidence: number;
  restrictionType: "NoFly" | "Restricted" | "PermissionRequired" | "Advisory";
  priority: number;
}

export interface MatchedRuleResult {
  id: string;
  ruleName: string;
  severity: ValidationStatus;
  reason: string;
  citationIds: string[];
}

export type ExplanationStageType =
  | "Input"
  | "SpatialMatch"
  | "TemporalMatch"
  | "RuleMatch"
  | "ConflictResolution"
  | "PermitRequirement"
  | "Citation"
  | "RiskEvaluation"
  | "Decision";

export interface ExplanationStageNode {
  stage: ExplanationStageType;
  targetId?: string;
  description: string;
}

export interface ValidationContext {
  id: string; // Unique Evaluation UUID
  timestamp: string; // UTC ISO-8601
  input: ValidationInput;
  results: {
    status: ValidationStatus;
    highestPriorityRule: string | null;
    matchedFeatures: MatchedFeatureResult[];
    matchedRules: MatchedRuleResult[];
    requiredPermits: string[];
    citations: Array<{
      id: string;
      documentId: string;
      authorityName: string;
      legalBasis: string;
      officialCircular: string;
      section: string;
      page: number;
      quoteStart: string;
      quoteEnd: string;
      ocrConfidence: number;
    }>;
    explanations: string[];
    structuredExplanations: ExplanationStageNode[];
    risk: {
      legal: number;
      safety: number;
      privacy: number;
      operational: number;
      environmental: number;
      overall: number;
    };
  };
  provenance: {
    engineVersion: string;
    rulesVersion: string;
    geoVersion: string;
  };
}
