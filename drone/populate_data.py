import json

airports = [
    {"name": "Tribhuvan International Airport (TIA)", "coords": [85.3591, 27.6966]},
    {"name": "Pokhara International Airport", "coords": [83.9826, 28.2080]},
    {"name": "Gautam Buddha International Airport", "coords": [83.4194, 27.5066]},
    {"name": "Tenzing-Hillary Airport (Lukla)", "coords": [86.7294, 27.6869]},
    {"name": "Nepalgunj Airport", "coords": [81.6033, 28.1006]},
    {"name": "Biratnagar Airport", "coords": [87.2661, 26.4839]},
    {"name": "Simara Airport", "coords": [84.9786, 27.1664]},
    {"name": "Bharatpur Airport", "coords": [84.4283, 27.6775]},
    {"name": "Janakpur Airport", "coords": [85.9228, 26.7092]},
    {"name": "Dhangadhi Airport", "coords": [80.5753, 28.7533]},
    {"name": "Chandragadhi Airport", "coords": [88.0494, 26.5714]},
    {"name": "Surkhet Airport", "coords": [81.6361, 28.5861]},
    {"name": "Tumlingtar Airport", "coords": [87.1931, 27.3142]},
    {"name": "Jomsom Airport", "coords": [83.7225, 28.7817]},
    {"name": "Rara Airport", "coords": [82.0492, 29.5292]}
]

parks = [
    {"name": "Chitwan National Park", "coords": [84.4444, 27.5333]},
    {"name": "Sagarmatha National Park", "coords": [86.7333, 27.9500]},
    {"name": "Langtang National Park", "coords": [85.5000, 28.2500]},
    {"name": "Rara National Park", "coords": [82.0833, 29.5000]},
    {"name": "Shey Phoksundo National Park", "coords": [82.8833, 29.3500]},
    {"name": "Khaptad National Park", "coords": [81.1667, 29.3833]},
    {"name": "Bardiya National Park", "coords": [81.3333, 28.4667]},
    {"name": "Makalu Barun National Park", "coords": [87.1667, 27.7500]},
    {"name": "Shivapuri Nagarjun National Park", "coords": [85.3833, 27.8000]},
    {"name": "Banke National Park", "coords": [81.8000, 28.1833]},
    {"name": "Shuklaphanta National Park", "coords": [80.2500, 28.8500]},
    {"name": "Parsa National Park", "coords": [84.8667, 27.4667]},
    {"name": "Koshi Tappu Wildlife Reserve", "coords": [87.0000, 26.6500]},
    {"name": "Annapurna Conservation Area", "coords": [83.9667, 28.7667]},
    {"name": "Manaslu Conservation Area", "coords": [84.7333, 28.5333]}
]

heritage = [
    {"name": "Kathmandu Durbar Square", "coords": [85.3069, 27.7042]},
    {"name": "Patan Durbar Square", "coords": [85.3253, 27.6736]},
    {"name": "Bhaktapur Durbar Square", "coords": [85.4283, 27.6722]},
    {"name": "Swayambhunath Stupa", "coords": [85.2894, 27.7147]},
    {"name": "Boudhanath Stupa", "coords": [85.3619, 27.7214]},
    {"name": "Pashupatinath Temple", "coords": [85.3486, 27.7106]},
    {"name": "Changu Narayan Temple", "coords": [85.4281, 27.7161]},
    {"name": "Lumbini (Birthplace of Buddha)", "coords": [83.2758, 27.4794]}
]

def save_geojson(data, outfile, layer_name, buffer_m):
    features = []
    for i, item in enumerate(data):
        features.append({
            "type": "Feature",
            "properties": {
                "id": f"{layer_name}-{i+1}",
                "name": item["name"],
                "category": layer_name,
                "bufferMeters": buffer_m
            },
            "geometry": {
                "type": "Point",
                "coordinates": item["coords"]
            }
        })
        
    feature_collection = {
        "type": "FeatureCollection",
        "metadata": {
            "layer": layer_name,
            "version": "1.0.0"
        },
        "features": features
    }
    
    with open(outfile, 'w') as f:
        json.dump(feature_collection, f, indent=2)

save_geojson(airports, 'packages/country-nepal/data/geo/1.0.0/airports.geojson', 'airports', 5000)
save_geojson(parks, 'packages/country-nepal/data/geo/1.0.0/national_parks.geojson', 'national_parks', 0)
save_geojson(heritage, 'packages/country-nepal/data/geo/1.0.0/heritage_sites.geojson', 'heritage_sites', 1000)

print("GeoJSON files updated successfully.")
