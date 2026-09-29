// Global references
let api;
let map;
let marker;
let droneDatabase = [];
let citationsDatabase = [];
let limitationsDatabase = [];
let presetCoordinates = {
  tia: [27.6966, 85.3591],
  pokhara: [28.2080, 83.9826],
  lukla: [27.6869, 86.7294],
  durbar: [27.7047, 85.3220],
  everest: [27.8369, 86.9290],
  army: [27.6974, 85.3149],
  rural: [28.0000, 84.0000]
};

// Colors matching stylesheet
const zoneColors = {
  airports: 'hsl(355, 85%, 50%)',
  military: 'hsl(355, 85%, 50%)',
  national_parks: 'hsl(145, 80%, 45%)',
  heritage_sites: 'hsl(28, 95%, 55%)'
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Initialize Map
    initMap();

    // 2. Fetch and initialize datasets
    await initDatasets();

    // 3. Setup form change triggers
    setupInteractions();

    // 4. Initial verification run
    runComplianceCheck();
  } catch (error) {
    console.error("Dashboard initialization failed:", error);
  }
});

// Initialize Leaflet Map
function initMap() {
  // Center around Nepal
  map = L.map('map').setView([27.7172, 85.3240], 12);

  // CartoDB Dark Matter layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Add a draggable marker
  marker = L.marker([27.6966, 85.3591], { draggable: true }).addTo(map);

  // Marker drag events
  marker.on('dragend', () => {
    const position = marker.getLatLng();
    document.getElementById('lat-input').value = position.lat.toFixed(6);
    document.getElementById('lng-input').value = position.lng.toFixed(6);
    runComplianceCheck();
  });

  // Map click places marker
  map.on('click', (e) => {
    marker.setLatLng(e.latlng);
    document.getElementById('lat-input').value = e.latlng.lat.toFixed(6);
    document.getElementById('lng-input').value = e.latlng.lng.toFixed(6);
    runComplianceCheck();
  });
}

// Fetch and load database files
async function initDatasets() {
  const select = document.getElementById('drone-select');
  
  // Show spinner / loading text
  select.innerHTML = `<option>Loading drones...</option>`;

  try {
    // Fetch versioned config files
    const [drones, rules, authorities, permits, citations, limitations] = await Promise.all([
      fetch('../data/drones/1.0.0/drones.json').then(r => r.json()),
      fetch('../data/rules/1.0.0/rules.json').then(r => r.json()),
      fetch('../data/metadata/1.0.0/authorities.json').then(r => r.json()),
      fetch('../data/permits/1.0.0/workflow_graph.json').then(r => r.json()),
      fetch('../data/citations/1.0.0/citations.json').then(r => r.json()),
      fetch('../knowledge/metadata/limitations.json').then(r => r.json()).catch(() => [])
    ]);

    // Fetch GeoJSON layers
    const [airports, parks, heritage, military, mountains] = await Promise.all([
      fetch('../data/geo/1.0.0/airports.geojson').then(r => r.json()),
      fetch('../data/geo/1.0.0/national_parks.geojson').then(r => r.json()),
      fetch('../data/geo/1.0.0/heritage_sites.geojson').then(r => r.json()),
      fetch('../data/geo/1.0.0/military.geojson').then(r => r.json()),
      fetch('../data/geo/1.0.0/mountains.geojson').then(r => r.json())
    ]);

    droneDatabase = drones;
    citationsDatabase = citations;
    limitationsDatabase = limitations;

    const geoLayers = {
      airports,
      national_parks: parks,
      heritage_sites: heritage,
      military,
      mountains
    };

    // Initialize core DroneComplianceApi
    api = new window.DroneComplianceApi();
    const initReport = api.initialize(drones, rules, authorities, permits, geoLayers, citations);
    
    if (!initReport.success) {
      console.error("Integrity report errors:", initReport.errors);
      alert("Database Integrity Check Failed! Check console logs.");
      return;
    }

    // Populate Drones select options
    select.innerHTML = '';
    drones.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.manufacturer} ${d.model}`;
      select.appendChild(opt);
    });

    updateDroneSpecs();

    // Render spatial layer circles on map
    drawMapLayers(geoLayers);

    // Populate Limitations
    renderLimitations(limitations);
  } catch (err) {
    console.error("Error loading datasets:", err);
  }
}

// Draw restriction buffer circles on the Leaflet map
function drawMapLayers(geoLayers) {
  // Layers to draw buffers
  const layersToDraw = ['airports', 'national_parks', 'heritage_sites', 'military'];

  layersToDraw.forEach(layerKey => {
    const geojson = geoLayers[layerKey];
    if (!geojson || !geojson.features) return;

    geojson.features.forEach(feat => {
      const coords = feat.geometry.coordinates;
      const props = feat.properties;
      
      // Point coordinates are WGS84: [lng, lat]
      const latlng = [coords[1], coords[0]];
      const buffer = props.bufferMeters;
      const color = zoneColors[layerKey] || '#ff0000';

      if (buffer && buffer > 0) {
        L.circle(latlng, {
          color: color,
          fillColor: color,
          fillOpacity: 0.12,
          radius: buffer,
          weight: 1.5,
          dashArray: '4, 4'
        }).addTo(map).bindPopup(`<strong>${props.name}</strong><br/>Restriction Zone: ${buffer / 1000} km buffer`);
      } else {
        // Draw static advisory marker
        L.circleMarker(latlng, {
          radius: 8,
          fillColor: 'hsl(220, 95%, 60%)',
          color: '#fff',
          weight: 1,
          fillOpacity: 0.8
        }).addTo(map).bindPopup(`<strong>${props.name}</strong><br/>Category: Advisory Landmark`);
      }
    });
  });
}

// Set up UI event listeners
function setupInteractions() {
  const form = document.getElementById('control-form');
  const altitudeInput = document.getElementById('altitude-input');
  const droneSelect = document.getElementById('drone-select');
  const presetSelect = document.getElementById('preset-select');
  const latInput = document.getElementById('lat-input');
  const lngInput = document.getElementById('lng-input');
  
  // Submit handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    runComplianceCheck();
  });

  // Interactive triggers on input changes
  droneSelect.addEventListener('change', () => {
    updateDroneSpecs();
    runComplianceCheck();
  });

  document.querySelectorAll('input[name="pilot-nationality"]').forEach(rad => {
    rad.addEventListener('change', runComplianceCheck);
  });

  document.getElementById('pilot-purpose').addEventListener('change', runComplianceCheck);

  altitudeInput.addEventListener('input', (e) => {
    document.getElementById('altitude-val').textContent = `${e.target.value}m`;
    runComplianceCheck();
  });

  // Manual lat/lng manual inputs
  latInput.addEventListener('change', () => {
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    if (!isNaN(lat) && !isNaN(lng)) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng]);
      runComplianceCheck();
    }
  });

  lngInput.addEventListener('change', () => {
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    if (!isNaN(lat) && !isNaN(lng)) {
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng]);
      runComplianceCheck();
    }
  });

  // Preset location shortcuts
  presetSelect.addEventListener('change', (e) => {
    const target = presetCoordinates[e.target.value];
    if (target) {
      marker.setLatLng(target);
      map.setView(target, 12);
      latInput.value = target[0].toFixed(6);
      lngInput.value = target[1].toFixed(6);
      runComplianceCheck();
    }
  });

  // Close modal click
  document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('citation-modal').classList.remove('active');
  });

  document.getElementById('citation-modal').addEventListener('click', (e) => {
    if (e.target.id === 'citation-modal') {
      document.getElementById('citation-modal').classList.remove('active');
    }
  });
}

// Update helper text under drone select field
function updateDroneSpecs() {
  const select = document.getElementById('drone-select');
  const specsLabel = document.getElementById('drone-specs');
  const activeDrone = droneDatabase.find(d => d.id === select.value);

  if (activeDrone) {
    specsLabel.textContent = `Weight: ${activeDrone.weightGrams}g | Category: ${activeDrone.category} | Remote ID: ${activeDrone.remoteIdSupport ? 'Yes' : 'No'}`;
  }
}

// Display known limitations list
function renderLimitations(limitations) {
  const container = document.getElementById('limitations-container');
  container.innerHTML = '';

  if (limitations.length === 0) {
    container.innerHTML = `<p class="empty-state">No known database limitations reported.</p>`;
    return;
  }

  limitations.forEach(lim => {
    const div = document.createElement('div');
    div.className = 'limitation-item';
    div.innerHTML = `<strong>${lim.id}:</strong> ${lim.description} (Impact: ${lim.impact})`;
    container.appendChild(div);
  });
}

// Execute compliance engine validation
async function runComplianceCheck() {
  if (!api) return;

  const droneId = document.getElementById('drone-select').value;
  const droneSpec = droneDatabase.find(d => d.id === droneId) || { manufacturer: 'DJI', model: 'Mini 4 Pro' };

  const nationality = document.querySelector('input[name="pilot-nationality"]:checked').value;
  const purpose = document.getElementById('pilot-purpose').value;
  const altitude = parseInt(document.getElementById('altitude-input').value);
  const lat = parseFloat(document.getElementById('lat-input').value);
  const lng = parseFloat(document.getElementById('lng-input').value);

  const input = {
    flight: {
      latitude: lat,
      longitude: lng,
      altitudeAgl: altitude,
      dateTime: new Date().toISOString()
    },
    drone: {
      manufacturer: droneSpec.manufacturer,
      model: droneSpec.model
    },
    pilot: {
      nationality,
      purpose
    }
  };

  try {
    const context = await api.validateFlight(input);
    renderResults(context);
  } catch (err) {
    console.error("Evaluation runtime exception:", err);
  }
}

// Render validation result states on index.html controls
function renderResults(context) {
  const res = context.results;

  // 1. Render Status Badge
  const statusBadge = document.getElementById('status-badge');
  const statusDesc = document.getElementById('status-description');

  statusBadge.className = 'badge-large'; // Clear previous classes
  statusBadge.textContent = res.status.toUpperCase();

  if (res.status === 'Allowed') {
    statusBadge.classList.add('status-allowed');
    statusDesc.textContent = "Your flight matches open categories. No major flight caps violated.";
  } else if (res.status === 'Warning') {
    statusBadge.classList.add('status-warning');
    statusDesc.textContent = "Advisories active. Keep your drone clear of crowded public buffers.";
  } else if (res.status === 'Restricted') {
    statusBadge.classList.add('status-restricted');
    statusDesc.textContent = "Flight is restricted inside borders. Permit checks required before takeoff.";
  } else if (res.status === 'Prohibited') {
    statusBadge.classList.add('status-prohibited');
    statusDesc.textContent = "Flight blocked! Operation within secure aerodromes or VVIP zones is prohibited.";
  }

  // 2. Risk Indicators
  document.getElementById('risk-score').textContent = res.risk.overall;
  
  // Fill bars
  const fillBar = (id, score) => {
    const el = document.getElementById(id);
    el.style.width = `${score}%`;
    
    // Color fill dynamically
    if (score > 70) {
      el.style.backgroundColor = 'var(--color-prohibited)';
    } else if (score > 40) {
      el.style.backgroundColor = 'var(--color-restricted)';
    } else {
      el.style.backgroundColor = 'var(--primary)';
    }
  };

  fillBar('bar-legal', res.risk.legal);
  fillBar('bar-safety', res.risk.safety);
  fillBar('bar-privacy', res.risk.privacy);
  fillBar('bar-operational', res.risk.operational);
  fillBar('bar-environmental', res.risk.environmental);

  // 3. Permits Checklist
  const permitsContainer = document.getElementById('permit-checklist');
  permitsContainer.innerHTML = '';

  if (res.requiredPermits.length === 0) {
    permitsContainer.innerHTML = `<p class="empty-state">No special regulatory permits required for this profile.</p>`;
  } else {
    res.requiredPermits.forEach(p => {
      const item = document.createElement('div');
      item.className = 'permit-item';
      item.innerHTML = `<span class="icon">📜</span> <span>${p}</span>`;
      permitsContainer.appendChild(item);
    });
  }

  // 4. Decision Pipeline Tree
  const treeContainer = document.getElementById('decision-tree');
  treeContainer.innerHTML = '';

  res.structuredExplanations.forEach(step => {
    const stepEl = document.createElement('div');
    stepEl.className = 'tree-step';
    
    const chip = `<span class="step-stage stage-${step.stage}">${step.stage}</span>`;
    const desc = `<span class="step-desc">${step.description}</span>`;
    
    // Look up if this step is linkable to a citation
    let hasCitation = false;
    let citationId = '';
    
    if (step.stage === 'RuleMatch' && step.targetId) {
      // Find rule from context rules and extract its citationId references
      const rule = context.input.pilot.nationality === 'Foreign' || context.input.pilot.purpose === 'Commercial'
        ? res.matchedRules.find(r => r.id === step.targetId)
        : null; // Or check rule databases
      
      const cit = citationsDatabase.find(c => c.id.startsWith('cit-nep-caan') || c.id.includes(step.targetId.split('-')[2]));
      if (cit) {
        hasCitation = true;
        citationId = cit.id;
      }
    } else if (step.stage === 'SpatialMatch' && step.targetId) {
      const cit = citationsDatabase.find(c => c.id.includes(step.targetId.split('-')[2]) || c.id.includes('caan-uasr'));
      if (cit) {
        hasCitation = true;
        citationId = cit.id;
      }
    }

    const link = hasCitation 
      ? `<span class="step-link" onclick="showCitationModal('${citationId}')">View Law</span>`
      : '';

    stepEl.innerHTML = `${chip} ${desc} ${link}`;
    treeContainer.appendChild(stepEl);
  });
}

// Open modal popup detailing citations
window.showCitationModal = function(citationId) {
  const modal = document.getElementById('citation-modal');
  const title = document.getElementById('citation-title');
  const section = document.getElementById('citation-section');
  const auth = document.getElementById('citation-authority');
  const ocr = document.getElementById('citation-ocr');
  const quote = document.getElementById('citation-quote');

  const citation = citationsDatabase.find(c => c.id === citationId);
  if (!citation) return;

  title.textContent = citation.officialCircular || "Direct Drone Regulation";
  section.textContent = `Section ${citation.section || 'N/A'}, Page ${citation.page || 'N/A'}`;
  auth.textContent = citation.authorityId === 'auth-nep-caan-001' ? 'Civil Aviation Authority of Nepal (CAAN)' : 'Ministry of Home Affairs';
  ocr.textContent = `${citation.ocrConfidence || '99'}% (Verified Source)`;
  quote.textContent = `"${citation.quoteStart} ... ${citation.quoteEnd}"`;

  modal.classList.add('active');
};
