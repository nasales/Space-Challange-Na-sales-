"""Featured case studies (Ivan). Point data from NASA POWER monthly, 1981-2024.

`context` is a short English sentence for the player; Ivan writes it later.
"""

START_YEAR = 1981
END_YEAR = 2024

CASES = [
    {"id": "dana_valencia", "title": "Valencia DANA", "place": "Valencia",
     "lat": 39.47, "lon": -0.38, "variables": ["PRECTOTCORR", "T2M"], "context": "TODO"},
    {"id": "donana", "title": "Doñana wetlands", "place": "Doñana",
     "lat": 37.00, "lon": -6.45, "variables": ["GWETTOP", "PRECTOTCORR"], "context": "TODO"},
    {"id": "sierra_culebra", "title": "Sierra de la Culebra fire", "place": "Sierra de la Culebra (Zamora)",
     "lat": 41.90, "lon": -6.30, "variables": ["T2M", "GWETTOP"], "context": "TODO"},
    {"id": "galicia_fires", "title": "Galicia fires", "place": "Ourense (Galicia)",
     "lat": 42.30, "lon": -7.90, "variables": ["T2M", "GWETTOP"], "context": "TODO"},
    {"id": "ebro_delta", "title": "Ebro Delta", "place": "Ebro Delta",
     "lat": 40.70, "lon": 0.75, "variables": ["PRECTOTCORR", "T2M"], "context": "TODO"},
    {"id": "filomena_madrid", "title": "Storm Filomena", "place": "Madrid",
     "lat": 40.42, "lon": -3.70, "variables": ["T2M"], "context": "TODO"},
    {"id": "almeria_murcia", "title": "Almería-Murcia drylands", "place": "Almería-Murcia",
     "lat": 37.30, "lon": -1.90, "variables": ["PRECTOTCORR", "GWETTOP"], "context": "TODO"},
]


def get_case(case_id: str) -> dict:
    for case in CASES:
        if case["id"] == case_id:
            return case
    raise KeyError(f"unknown case {case_id!r}")
