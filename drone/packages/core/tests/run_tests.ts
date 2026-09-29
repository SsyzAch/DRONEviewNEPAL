import * as fs from "fs";
import * as path from "path";
import { ApiLayer } from "../src/api/apiLayer";
import { ValidationInput } from "../src/types";

// Scenarios to test
const scenarios: Array<{
  name: string;
  input: ValidationInput;
  expectedStatus: string;
  expectedPermitsContains?: string[];
  expectedCitationsContains?: string[];
}> = [
  {
    "name": "Scenario 1: Flight inside Tribhuvan International Airport 5 km Buffer Zone",
    "input": {
      "flight": {
        "latitude": 27.6966,
        "longitude": 85.3591,
        "altitudeAgl": 50,
        "dateTime": "2026-06-30T10:00:00Z"
      },
      "drone": {
        "manufacturer": "DJI",
        "model": "Mini 4 Pro"
      },
      "pilot": {
        "nationality": "Nepali",
        "purpose": "Recreational"
      }
    },
    "expectedStatus": "Prohibited",
    "expectedCitationsContains": ["UASR Reg. 101.7(b)(5) & Reg. 101.23"]
  },
  {
    "name": "Scenario 2: Foreign Tourist Commercial Mapping in Sagarmatha National Park",
    "input": {
      "flight": {
        "latitude": 27.8369,
        "longitude": 86.9290,
        "altitudeAgl": 80,
        "dateTime": "2026-06-30T11:00:00Z"
      },
      "drone": {
        "manufacturer": "DJI",
        "model": "Mini 4 Pro"
      },
      "pilot": {
        "nationality": "Foreign",
        "purpose": "Commercial"
      }
    },
    "expectedStatus": "Restricted",
    "expectedPermitsContains": [
      "CAAN Drone Registration Certificate (Unique Identification Number)",
      "Ministry of Home Affairs Security Clearance Letter",
      "Department of Tourism Recommendation Approval",
      "CAAN Flight Operations Permit (FPN Number)",
      "Department of National Parks and Wildlife Conservation (DNPWC) Flight Approval"
    ]
  },
  {
    "name": "Scenario 3: Standard Recreational Open Rural Area Flight (Safe Profile)",
    "input": {
      "flight": {
        "latitude": 28.0,
        "longitude": 84.0,
        "altitudeAgl": 40,
        "dateTime": "2026-06-30T05:00:00Z" // 10:45 AM local Nepal time (Daylight)
      },
      "drone": {
        "manufacturer": "DJI",
        "model": "Mini 4 Pro"
      },
      "pilot": {
        "nationality": "Nepali",
        "purpose": "Recreational"
      }
    },
    "expectedStatus": "Allowed",
    "expectedPermitsContains": [
      "CAAN Drone Registration Certificate (Unique Identification Number)"
    ]
  }
];

async function runTests() {
  console.log("=== Running Drone Compliance Validation Engine Test Suite ===\n");

  const api = new ApiLayer();

  // Load Nepal datasets
  const baseDataPath = path.resolve(__dirname, "../../country-nepal/data");

  console.log(`Loading data from: ${baseDataPath}...`);

  const drones = JSON.parse(fs.readFileSync(path.join(baseDataPath, "drones/1.0.0/drones.json"), "utf8"));
  const rules = JSON.parse(fs.readFileSync(path.join(baseDataPath, "rules/1.0.0/rules.json"), "utf8"));
  const authorities = JSON.parse(fs.readFileSync(path.join(baseDataPath, "metadata/1.0.0/authorities.json"), "utf8"));
  const permitNodes = JSON.parse(fs.readFileSync(path.join(baseDataPath, "permits/1.0.0/workflow_graph.json"), "utf8"));
  const citations = JSON.parse(fs.readFileSync(path.join(baseDataPath, "citations/1.0.0/citations.json"), "utf8"));

  const geoPath = path.join(baseDataPath, "geo/1.0.0");
  const geoLayers = {
    airports: JSON.parse(fs.readFileSync(path.join(geoPath, "airports.geojson"), "utf8")),
    national_parks: JSON.parse(fs.readFileSync(path.join(geoPath, "national_parks.geojson"), "utf8")),
    heritage_sites: JSON.parse(fs.readFileSync(path.join(geoPath, "heritage_sites.geojson"), "utf8")),
    military: JSON.parse(fs.readFileSync(path.join(geoPath, "military.geojson"), "utf8")),
    mountains: JSON.parse(fs.readFileSync(path.join(geoPath, "mountains.geojson"), "utf8")),
  };

  // Initialize engine
  console.log("Initializing API Layer...");
  const initResult = api.initialize(drones, rules, authorities, permitNodes, geoLayers, citations);
  if (!initResult.success) {
    console.error("Initialization Failed!");
    console.error(initResult.errors);
    process.exit(1);
  }
  console.log("API Layer Initialized Successfully.\n");

  let passes = 0;
  let failures = 0;

  for (const scenario of scenarios) {
    console.log(`[TEST] ${scenario.name}`);
    try {
      const context = await api.validateFlight(scenario.input);
      const results = context.results;

      console.log(`  - Status: Resolved to ${results.status} (Expected: ${scenario.expectedStatus})`);
      
      let testPassed = true;
      if (results.status !== scenario.expectedStatus) {
        testPassed = false;
        console.error(`  [FAIL] Status mismatch. Got: ${results.status}, Expected: ${scenario.expectedStatus}`);
      }

      if (scenario.expectedPermitsContains) {
        for (const permit of scenario.expectedPermitsContains) {
          if (!results.requiredPermits.includes(permit)) {
            testPassed = false;
            console.error(`  [FAIL] Missing expected permit: "${permit}"`);
          }
        }
      }

      if (scenario.expectedCitationsContains) {
        const legalBases = results.citations.map((c) => c.legalBasis);
        for (const citation of scenario.expectedCitationsContains) {
          if (!legalBases.includes(citation)) {
            testPassed = false;
            console.error(`  [FAIL] Missing expected citation: "${citation}"`);
          }
        }
      }

      if (testPassed) {
        console.log(`  [PASS] Scenario successfully evaluated.`);
        passes++;
      } else {
        failures++;
      }

      // Log explanations generated
      console.log("  - Explanation Trail:");
      for (const line of results.explanations.slice(0, 4)) {
        console.log(`    * ${line}`);
      }
      if (results.explanations.length > 4) {
        console.log(`    * ... (${results.explanations.length - 4} more explanations)`);
      }
      console.log();
    } catch (err) {
      console.error(`  [ERROR] Execution failed for test case:`, err);
      failures++;
    }
  }

  console.log(`Test Execution Complete: ${passes} passed, ${failures} failed.`);
  if (failures > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
