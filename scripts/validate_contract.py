"""Validate data/cache JSON files against docs/contract.md. Standard library only."""
import json
import sys

REQUIRED = {
    "place": str, "lat": (int, float), "lon": (int, float), "variable": str,
    "units": str, "dataset": str, "dates": list, "values": list,
    "slope": (int, float), "p_value": (int, float), "significant": bool, "test": str,
}


def check(path):
    errors = []
    try:
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
    except Exception as e:  # noqa: BLE001
        return [f"cannot read JSON: {e}"]
    for key, typ in REQUIRED.items():
        if key not in d:
            errors.append(f"missing '{key}'")
        elif not isinstance(d[key], typ) or (typ != bool and isinstance(d[key], bool)):
            errors.append(f"'{key}' has wrong type")
    if errors:
        return errors
    if len(d["dates"]) != len(d["values"]):
        errors.append("dates and values have different lengths")
    if len(d["values"]) < 24:
        errors.append(f"only {len(d['values'])} points; too short for a trend")
    if not 0 <= d["p_value"] <= 1:
        errors.append("p_value outside 0-1")
    if d["significant"] != (d["p_value"] < 0.05):
        errors.append("'significant' does not match p_value < 0.05")
    if not -90 <= d["lat"] <= 90 or not -180 <= d["lon"] <= 180:
        errors.append("lat/lon out of range")
    if all(v is None for v in d["values"]):
        errors.append("all values are null")
    return errors


def main(paths):
    bad = 0
    for p in paths:
        errs = check(p)
        if errs:
            bad += 1
            print(f"    {p}: " + "; ".join(errs))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
