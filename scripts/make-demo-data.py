#!/usr/bin/env python3
"""Generates data/strava.json with clearly-labelled DEMO data so the site can be
previewed before the Strava account is connected. Replaced automatically by
scripts/fetch-strava.mjs once the GitHub Action runs."""
import json, math, random, datetime as dt, pathlib

random.seed(40075)
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "strava.json"


def encode_polyline(points):
    out = []
    prev_lat = prev_lng = 0
    for lat, lng in points:
        for v, p in ((lat, prev_lat), (lng, prev_lng)):
            d = int(round(v * 1e5)) - int(round(p * 1e5))
            d = ~(d << 1) if d < 0 else d << 1
            while d >= 0x20:
                out.append(chr((0x20 | (d & 0x1F)) + 63))
                d >>= 5
            out.append(chr(d + 63))
        prev_lat, prev_lng = lat, lng
    return "".join(out)


def route(kind, km):
    """Synthetic route shapes: loop, out-and-back, figure-8."""
    n = 80
    pts = []
    scale = km / 100.0  # rough degrees
    for i in range(n + 1):
        t = i / n * 2 * math.pi
        if kind == "loop":
            x, y = math.cos(t), 0.6 * math.sin(t) + 0.15 * math.sin(3 * t)
        elif kind == "eight":
            x, y = math.sin(t), math.sin(2 * t) * 0.6
        else:  # out and back
            s = (i / n) * 2 if i <= n / 2 else 2 - (i / n) * 2
            x, y = s * 1.6 - 0.8, 0.25 * math.sin(s * 4) + 0.003 * (1 if i <= n / 2 else -1)
        pts.append((1.30 + y * scale, 103.80 + x * scale))
    return encode_polyline(pts)


now = dt.datetime(2026, 11, 2, 7, 30)
names = [
    ("Sunrise tempo loop", "loop"), ("Easy recovery roll", "eight"), ("Long endurance skate", "out"),
    ("Intervals 8 x 2 km", "loop"), ("Group skate with the club", "out"), ("Technique drills + cadence", "eight"),
    ("Marathon pace rehearsal", "out"), ("Hill repeats", "loop"), ("Night city skate", "eight"),
    ("Steady 90 minutes", "out"), ("Speed session", "loop"), ("Social Sunday skate", "eight"),
]

acts = []
day = now
for i, (name, kind) in enumerate(names):
    day = day - dt.timedelta(days=random.choice([1, 2, 2, 3]))
    km = random.choice([18.4, 24.9, 42.3, 31.2, 36.8, 15.6, 42.2, 21.7, 19.3, 38.5, 27.4, 30.1])
    speed = random.uniform(24.5, 31.5) if km < 40 else random.uniform(27.0, 30.0)
    moving = int(km / speed * 3600)
    acts.append({
        "id": 15000000000 + i,
        "name": name,
        "sport_type": "InlineSkate",
        "date": day.replace(hour=random.choice([6, 7, 18, 19]), minute=random.randint(0, 59)).isoformat(),
        "distance_m": int(km * 1000),
        "moving_time_s": moving,
        "elapsed_time_s": int(moving * random.uniform(1.03, 1.15)),
        "elevation_m": random.randint(30, 260),
        "avg_speed_kmh": round(speed, 2),
        "max_speed_kmh": round(speed + random.uniform(8, 16), 2),
        "avg_hr": random.randint(138, 164),
        "kudos": random.randint(4, 38),
        "polyline": route(kind, km),
        "url": "https://www.strava.com/",
    })


def totals(xs):
    return {
        "count": len(xs),
        "distance_m": sum(a["distance_m"] for a in xs),
        "moving_time_s": sum(a["moving_time_s"] for a in xs),
        "elevation_m": sum(a["elevation_m"] for a in xs),
    }


weekly = []
monday = now.date() - dt.timedelta(days=now.weekday())
for w in range(15, -1, -1):
    ws = monday - dt.timedelta(weeks=w)
    km = random.choice([0, 48, 72, 95, 110, 134, 156, 88, 121, 64])
    cnt = 0 if km == 0 else max(1, round(km / 28))
    weekly.append({"week_start": ws.isoformat(), "count": cnt, "distance_m": km * 1000,
                   "moving_time_s": int(km / 27.5 * 3600), "elevation_m": km * 6})

last4w = totals(acts[:6])
ytd = {"count": 142, "distance_m": 3864000, "moving_time_s": 505000, "elevation_m": 18400}
l12 = {"count": 171, "distance_m": 4612000, "moving_time_s": 603000, "elevation_m": 22100}

longest = max(acts, key=lambda a: a["distance_m"])
fastest = max([a for a in acts if a["distance_m"] >= 10000], key=lambda a: a["avg_speed_kmh"])
climb = max(acts, key=lambda a: a["elevation_m"])
pick = lambda a, **e: {"id": a["id"], "name": a["name"], "date": a["date"], "distance_m": a["distance_m"], "moving_time_s": a["moving_time_s"], **e}

data = {
    "generated_at": now.isoformat() + "Z",
    "source": "demo",
    "sport_types": ["InlineSkate"],
    "athlete": {"id": 0, "firstname": "Konstantin", "lastname": "Lyuik", "city": None, "country": None,
                "profile": None, "url": "https://www.strava.com/clubs/rollerearth40075"},
    "totals": {"last_4_weeks": last4w, "year_to_date": ytd, "last_12_months": l12,
               "by_sport_type": {"InlineSkate": l12}},
    "weekly": weekly,
    "records": {
        "longest_distance": pick(longest),
        "fastest_avg_speed_10k": pick(fastest, avg_speed_kmh=fastest["avg_speed_kmh"]),
        "longest_time": pick(max(acts, key=lambda a: a["moving_time_s"])),
        "biggest_climb": pick(climb, elevation_m=climb["elevation_m"]),
    },
    "recent": acts,
}
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps(data, indent=2))
print("wrote", OUT)
