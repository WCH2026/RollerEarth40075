#!/usr/bin/env node
/**
 * Fetches the athlete's own activities from the Strava API and writes
 * data/strava.json for the static site.
 *
 * Required environment variables (set as GitHub Actions secrets):
 *   STRAVA_CLIENT_ID
 *   STRAVA_CLIENT_SECRET
 *   STRAVA_REFRESH_TOKEN
 *
 * Optional:
 *   STRAVA_SPORT_TYPES   comma-separated list of sport types to include in
 *                        statistics (default: "InlineSkate"). Use "ALL" to
 *                        include every activity type.
 *   STRAVA_RECENT_COUNT  how many recent activities to list (default 12)
 *   STRAVA_JOURNEY_START ISO date (YYYY-MM-DD) when the 40,075 km expedition
 *                        started. Distance since then is written to "journey"
 *                        for the site's counter. Default: 1 January of the
 *                        current year.
 *   OUTPUT               output path (default data/strava.json)
 *
 * No npm dependencies — Node 18+ only (uses global fetch).
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const API = "https://www.strava.com/api/v3";
const {
  STRAVA_CLIENT_ID,
  STRAVA_CLIENT_SECRET,
  STRAVA_REFRESH_TOKEN,
  STRAVA_SPORT_TYPES = "InlineSkate",
  STRAVA_RECENT_COUNT = "12",
  STRAVA_JOURNEY_START = "",
  OUTPUT = "data/strava.json",
} = process.env;

for (const [k, v] of Object.entries({ STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN })) {
  if (!v) {
    console.error(`Missing environment variable ${k}`);
    process.exit(1);
  }
}

const includeAll = STRAVA_SPORT_TYPES.trim().toUpperCase() === "ALL";
const sportTypes = new Set(STRAVA_SPORT_TYPES.split(",").map((s) => s.trim()).filter(Boolean));
const matchesSport = (a) => includeAll || sportTypes.has(a.sport_type) || sportTypes.has(a.type);

async function getAccessToken() {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: STRAVA_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token;
}

async function api(path, token, params = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) throw new Error("Strava rate limit reached (429). Try again in 15 minutes.");
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** All activities since `afterUnix` (seconds), newest first. */
async function fetchActivitiesSince(token, afterUnix) {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await api("/athlete/activities", token, { after: afterUnix, per_page: 200, page });
    all.push(...batch);
    if (batch.length < 200) break;
  }
  return all.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
}

const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);

function totals(acts) {
  return {
    count: acts.length,
    distance_m: Math.round(sum(acts, (a) => a.distance)),
    moving_time_s: sum(acts, (a) => a.moving_time),
    elevation_m: Math.round(sum(acts, (a) => a.total_elevation_gain)),
  };
}

function startOfWeekUTC(d) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

function weeklySeries(acts, weeks = 16) {
  const now = new Date();
  const thisWeek = startOfWeekUTC(now);
  const series = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(thisWeek);
    ws.setUTCDate(ws.getUTCDate() - i * 7);
    const we = new Date(ws);
    we.setUTCDate(we.getUTCDate() + 7);
    const inWeek = acts.filter((a) => {
      const t = new Date(a.start_date);
      return t >= ws && t < we;
    });
    series.push({ week_start: ws.toISOString().slice(0, 10), ...totals(inWeek) });
  }
  return series;
}

function records(acts) {
  const withDist = acts.filter((a) => a.distance > 0 && a.moving_time > 0);
  const longest = withDist.reduce((m, a) => (!m || a.distance > m.distance ? a : m), null);
  const over10k = withDist.filter((a) => a.distance >= 10000);
  const fastest = over10k.reduce(
    (m, a) => (!m || a.distance / a.moving_time > m.distance / m.moving_time ? a : m),
    null
  );
  const longestTime = withDist.reduce((m, a) => (!m || a.moving_time > m.moving_time ? a : m), null);
  const climb = withDist.reduce((m, a) => (!m || a.total_elevation_gain > m.total_elevation_gain ? a : m), null);
  const pick = (a, extra) =>
    a && { id: a.id, name: a.name, date: a.start_date_local, distance_m: Math.round(a.distance), moving_time_s: a.moving_time, ...extra };
  return {
    longest_distance: pick(longest),
    fastest_avg_speed_10k: pick(fastest, { avg_speed_kmh: fastest && +(fastest.distance / fastest.moving_time * 3.6).toFixed(2) }),
    longest_time: pick(longestTime),
    biggest_climb: pick(climb, { elevation_m: climb && Math.round(climb.total_elevation_gain) }),
  };
}

function slimActivity(a) {
  return {
    id: a.id,
    name: a.name,
    sport_type: a.sport_type || a.type,
    date: a.start_date_local,
    distance_m: Math.round(a.distance),
    moving_time_s: a.moving_time,
    elapsed_time_s: a.elapsed_time,
    elevation_m: Math.round(a.total_elevation_gain || 0),
    avg_speed_kmh: a.moving_time ? +((a.distance / a.moving_time) * 3.6).toFixed(2) : null,
    max_speed_kmh: a.max_speed ? +(a.max_speed * 3.6).toFixed(2) : null,
    avg_hr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    kudos: a.kudos_count ?? 0,
    polyline: a.map?.summary_polyline || null,
    url: `https://www.strava.com/activities/${a.id}`,
  };
}

async function main() {
  const token = await getAccessToken();
  const athlete = await api("/athlete", token);

  const now = new Date();
  const yearStart = Date.UTC(now.getUTCFullYear(), 0, 1) / 1000;
  const twelveMonthsAgo = Math.floor((now.getTime() - 366 * 86400 * 1000) / 1000);
  const journeyStartIso = /^\d{4}-\d{2}-\d{2}$/.test(STRAVA_JOURNEY_START)
    ? STRAVA_JOURNEY_START
    : `${now.getUTCFullYear()}-01-01`;
  const journeyStart = Date.parse(journeyStartIso + "T00:00:00Z") / 1000;
  const since = Math.min(yearStart, twelveMonthsAgo, journeyStart);

  const activities = (await fetchActivitiesSince(token, since)).filter(matchesSport);
  const ytd = activities.filter((a) => new Date(a.start_date).getUTCFullYear() === now.getUTCFullYear());
  const last4w = activities.filter((a) => now - new Date(a.start_date) <= 28 * 86400 * 1000);
  const last12m = activities.filter((a) => now - new Date(a.start_date) <= 365 * 86400 * 1000);
  const journeyActs = activities.filter((a) => new Date(a.start_date).getTime() / 1000 >= journeyStart);

  const byType = {};
  for (const a of last12m) {
    const t = a.sport_type || a.type;
    byType[t] = byType[t] || [];
    byType[t].push(a);
  }

  const data = {
    generated_at: now.toISOString(),
    source: "strava",
    sport_types: includeAll ? "ALL" : [...sportTypes],
    athlete: {
      id: athlete.id,
      firstname: athlete.firstname,
      lastname: athlete.lastname,
      city: athlete.city,
      country: athlete.country,
      profile: athlete.profile,
      url: `https://www.strava.com/athletes/${athlete.id}`,
    },
    totals: {
      last_4_weeks: totals(last4w),
      year_to_date: totals(ytd),
      last_12_months: totals(last12m),
      by_sport_type: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, totals(v)])),
    },
    // Expedition counter: everything skated since the journey start date.
    journey: { start_date: journeyStartIso, goal_km: 40075, ...totals(journeyActs) },
    weekly: weeklySeries(last12m, 16),
    records: records(last12m),
    recent: activities.slice(0, Number(STRAVA_RECENT_COUNT)).map(slimActivity),
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(data, null, 2));
  console.log(`Wrote ${OUTPUT}: ${activities.length} activities, ${data.recent.length} recent, YTD ${(data.totals.year_to_date.distance_m / 1000).toFixed(1)} km, journey ${(data.journey.distance_m / 1000).toFixed(1)} km since ${journeyStartIso}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
