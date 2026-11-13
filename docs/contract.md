# Data contract (backend → interface)

Changing this file requires approval from Person 3 (data) AND Yeipi (interface).
`./scripts/check.sh` validates every JSON file in `data/cache/` against this contract.

## Required fields
| Field | Type | Meaning |
|---|---|---|
| `place` | string | Place name shown to the player |
| `lat`, `lon` | number | Coordinates of the stop |
| `variable` | string | Variable id, e.g. `surface_temperature` |
| `units` | string | Units, e.g. `K`, `mm/day` |
| `dataset` | string | NASA source, e.g. `MERRA-2 M2TMNXSLV` |
| `dates` | string[] | ISO dates (`YYYY-MM` or `YYYY-MM-DD`) |
| `values` | number[] | Same length as `dates`; `null` allowed for gaps |
| `slope` | number | Trend per year, in `units`/year |
| `p_value` | number | Significance test p-value (0–1) |
| `significant` | boolean | `p_value < 0.05` |
| `test` | string | e.g. `mann-kendall` |

## Example
```json
{
  "place": "Sahara",
  "lat": 23.4, "lon": 12.0,
  "variable": "surface_temperature",
  "units": "K",
  "dataset": "MERRA-2 M2TMNXSLV",
  "dates": ["2000-01", "2000-02"],
  "values": [295.1, 297.3],
  "slope": 0.03,
  "p_value": 0.01,
  "significant": true,
  "test": "mann-kendall"
}
```
