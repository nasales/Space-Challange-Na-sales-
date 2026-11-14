"""Featured case studies (Ivan). Point data from NASA POWER monthly, 1981-2024.

`question` is shown to the player first, `context` below it (case texts: options drafted by AI,
chosen and edited by Ivan).
"""

START_YEAR = 1981
END_YEAR = 2024

CASES = [
    {"id": "dana_valencia", "title": "Valencia DANA", "place": "Valencia",
     "lat": 39.47, "lon": -0.38, "variables": ["PRECTOTCORR", "T2M"],
     "question": "After the 2024 DANA floods, is it raining more and more in Valencia, or is something else changing?",
     "context": "On 29 October 2024 a DANA storm dropped months of rain on Valencia in a few hours and killed more than 220 people."},
    {"id": "donana", "title": "Doñana wetlands", "place": "Doñana",
     "lat": 37.00, "lon": -6.45, "variables": ["GWETTOP", "PRECTOTCORR"],
     "question": "Doñana is running out of water. Is it the rain, or something the satellites cannot see?",
     "context": "In 2023 Santa Olalla, the largest lagoon in Doñana, dried up completely, while the aquifer below it is overexploited."},
    {"id": "sierra_culebra", "title": "Sierra de la Culebra fire", "place": "Sierra de la Culebra (Zamora)",
     "lat": 41.90, "lon": -6.30, "variables": ["T2M", "GWETTOP"],
     "question": "After the huge 2022 wildfire, is Sierra de la Culebra getting hotter and drier?",
     "context": "In June 2022 about 25,000 hectares burned in Sierra de la Culebra (Zamora), one of the largest wildfires in Spain."},
    {"id": "galicia_fires", "title": "Galicia fires", "place": "Ourense (Galicia)",
     "lat": 42.30, "lon": -7.90, "variables": ["T2M", "GWETTOP"],
     "question": "Galicia is green and wet, yet it burns more and more. What do temperature and soil say?",
     "context": "Ourense suffered major wildfires in 2017 and in August 2025, with tens of thousands of hectares burned."},
    {"id": "ebro_delta", "title": "Ebro Delta", "place": "Ebro Delta",
     "lat": 40.70, "lon": 0.75, "variables": ["PRECTOTCORR", "T2M"],
     "question": "After storm Gloria, is the climate of the Ebro Delta changing?",
     "context": "In January 2020 storm Gloria pushed the sea kilometres inland and flooded thousands of hectares of rice fields in the Ebro Delta."},
    {"id": "filomena_madrid", "title": "Storm Filomena", "place": "Madrid",
     "lat": 40.42, "lon": -3.70, "variables": ["T2M"],
     "question": "If Madrid had its biggest snowfall in half a century, does that mean it is not warming?",
     "context": "In January 2021 storm Filomena brought Madrid its heaviest snowfall in about 50 years."},
    {"id": "almeria_murcia", "title": "Almería-Murcia drylands", "place": "Almería-Murcia",
     "lat": 37.30, "lon": -1.90, "variables": ["PRECTOTCORR", "GWETTOP"],
     "question": "Is south-east Spain becoming even drier?",
     "context": "The south-east is the driest part of mainland Europe, home to the Tabernas desert and thousands of hectares of greenhouses."},
]


def get_case(case_id: str) -> dict:
    for case in CASES:
        if case["id"] == case_id:
            return case
    raise KeyError(f"unknown case {case_id!r}")
