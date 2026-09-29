import urllib.request
import urllib.parse
import json
import os

overpass_url = 'http://overpass-api.de/api/interpreter'

def get_geojson(query):
    encoded_query = urllib.parse.urlencode({'data': query}).encode('utf-8')
    req = urllib.request.Request(overpass_url, data=encoded_query)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print('Error:', e)
        return None

# Airports in Nepal
query_airports = """
[out:json];
area["ISO3166-1"="NP"][admin_level=2]->.searchArea;
(
  node["aeroway"="aerodrome"](area.searchArea);
  way["aeroway"="aerodrome"](area.searchArea);
  relation["aeroway"="aerodrome"](area.searchArea);
);
out center;
"""

# National Parks & Reserves
query_parks = """
[out:json];
area["ISO3166-1"="NP"][admin_level=2]->.searchArea;
(
  relation["boundary"="national_park"](area.searchArea);
  relation["leisure"="nature_reserve"](area.searchArea);
);
out center;
"""

# Heritage Sites
query_heritage = """
[out:json];
area["ISO3166-1"="NP"][admin_level=2]->.searchArea;
(
  node["heritage"](area.searchArea);
  way["heritage"](area.searchArea);
  relation["heritage"](area.searchArea);
);
out center;
"""

def parse_and_save(data, outfile, layer_name, default_buffer):
    features = []
    if not data or 'elements' not in data:
        return
    
    for el in data['elements']:
        lat = el.get('lat') or (el.get('center') and el['center'].get('lat'))
        lon = el.get('lon') or (el.get('center') and el['center'].get('lon'))
        tags = el.get('tags', {})
        name = tags.get('name', tags.get('name:en', 'Unnamed'))
        
        if not lat or not lon:
            continue
            
        feat = {
            "type": "Feature",
            "properties": {
                "id": f"{layer_name}-{el['id']}",
                "name": name,
                "category": layer_name,
                "bufferMeters": default_buffer
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            }
        }
        features.append(feat)
        
    feature_collection = {
        "type": "FeatureCollection",
        "metadata": {
            "layer": layer_name,
            "version": "1.0.0",
            "description": f"Auto-generated {layer_name} layer from OSM",
            "source": "OpenStreetMap",
            "country": "NPL"
        },
        "features": features
    }
    
    with open(outfile, 'w') as f:
        json.dump(feature_collection, f, indent=2)

print("Fetching Airports...")
airports = get_geojson(query_airports)
parse_and_save(airports, 'packages/country-nepal/data/geo/1.0.0/airports.geojson', 'airports', 5000)

print("Fetching Parks...")
parks = get_geojson(query_parks)
parse_and_save(parks, 'packages/country-nepal/data/geo/1.0.0/national_parks.geojson', 'national_parks', 0)

print("Fetching Heritage...")
heritage = get_geojson(query_heritage)
parse_and_save(heritage, 'packages/country-nepal/data/geo/1.0.0/heritage_sites.geojson', 'heritage_sites', 1000)

print("Done.")
