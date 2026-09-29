import * as fs from "fs";
import * as path from "path";
import { ApiLayer } from "../src/api/apiLayer";
import { ValidationInput } from "../src/types";

// Generates and evaluates 100 test scenarios covering boundary conditions
async function runScenarioGenerator() {
  console.log("=== Generating and Running 100 Automated Compliance Scenarios ===\n");

  const api = new ApiLayer();

  // Load Nepal datasets
  const baseDataPath = path.resolve(__dirname, "../../country-nepal/data");
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

  const initResult = api.initialize(drones, rules, authorities, permitNodes, geoLayers, citations);
  if (!initResult.success) {
    console.error("Initialization Failed!");
    process.exit(1);
  }

  let passes = 0;
  let failures = 0;

  // Generate 100 distinct combinations
  for (let i = 1; i <= 100; i++) {
    const isForeign = i % 2 === 0;
    const isCommercial = i % 3 === 0;
    const altitude = 10 + (i * 2.5); // ranges from 12.5m to 260m AGL
    
    // Choose coordinate targets (some near airports, some near parks, some near peaks, some random)
    let latitude = 27.6966;
    let longitude = 85.3591; // Default Tribhuvan Airport
    let locationType = "Airport Proximity";

    if (i % 4 === 1) {
      latitude = 27.8369;
      longitude = 86.9290; // Sagarmatha Park
      locationType = "National Park Zone";
    } else if (i % 4 === 2) {
      latitude = 28.0;
      longitude = 84.0; // Open Rural Safe
      locationType = "Open Country";
    } else if (i % 4 === 3) {
      latitude = 27.7047;
      longitude = 85.3220; // Kathmandu Durbar heritage
      locationType = "UNESCO Heritage Site";
    }

    const input: ValidationInput = {
      flight: {
        latitude,
        longitude,
        altitudeAgl: altitude,
        dateTime: "2026-06-30T10:00:00Z"
      },
      drone: {
        manufacturer: "DJI",
        model: "Mini 4 Pro"
      },
      pilot: {
        nationality: isForeign ? "Foreign" : "Nepali",
        purpose: isCommercial ? "Commercial" : "Recreational"
      }
    };

    try {
      const context = await api.validateFlight(input);
      const res = context.results;

      let scenarioPassed = true;

      // Assertion A: Rule logic for altitude cap (100m)
      if (altitude > 100 && res.status === "Allowed") {
        scenarioPassed = false;
        console.error(`  [FAIL] Scenario ${i}: Altitude is ${altitude}m but status resolved to Allowed.`);
      }

      // Assertion B: TIA airport proximity rule
      if (locationType === "Airport Proximity" && res.status !== "Prohibited") {
        scenarioPassed = false;
        console.error(`  [FAIL] Scenario ${i}: Within 5km of TIA but status resolved to: ${res.status}`);
      }

      // Assertion C: Risk score boundaries
      if (res.risk.overall < 0 || res.risk.overall > 100) {
        scenarioPassed = false;
        console.error(`  [FAIL] Scenario ${i}: Risk score out of bounds: ${res.risk.overall}`);
      }

      // Assertion D: Decision graph permit matching
      if (isForeign && !res.requiredPermits.includes("Ministry of Home Affairs Security Clearance Letter")) {
        scenarioPassed = false;
        console.error(`  [FAIL] Scenario ${i}: Foreign pilot has no MoHA clearance requirement.`);
      }

      if (scenarioPassed) {
        passes++;
      } else {
        failures++;
      }
    } catch (err) {
      console.error(`  [ERROR] Scenario ${i} failed during validation:`, err);
      failures++;
    }
  }

  console.log(`\nScenario Generation Complete: ${passes} passed, ${failures} failed.`);
  if (failures > 0) {
    process.exit(1);
  }
}

runScenarioGenerator().catch((err) => {
  console.error("Scenario generator crashed:", err);
  process.exit(1);
});
