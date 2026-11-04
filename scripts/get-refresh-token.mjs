#!/usr/bin/env node
/**
 * One-time helper: obtains a Strava refresh token for the athlete.
 *
 *   STRAVA_CLIENT_ID=... STRAVA_CLIENT_SECRET=... node scripts/get-refresh-token.mjs
 *
 * 1. The script prints an authorization URL. Open it in a browser while logged
 *    in to the athlete's Strava account and click "Authorize".
 * 2. The browser is redirected to http://localhost/exchange_token?...&code=XXXX
 *    (the page will not load — that is expected). Copy the `code` value from
 *    the address bar and paste it into the terminal.
 * 3. The script prints the refresh token. Store it as the GitHub secret
 *    STRAVA_REFRESH_TOKEN. Never commit it to the repository.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } = process.env;
if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
  console.error("Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET first.");
  process.exit(1);
}

const authUrl =
  `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}` +
  `&response_type=code&redirect_uri=http://localhost/exchange_token` +
  `&approval_prompt=force&scope=read,activity:read_all`;

console.log("\n1) Open this URL in the athlete's browser and click Authorize:\n");
console.log(authUrl + "\n");
console.log("2) After redirect, copy the `code=` value from the address bar.\n");

const rl = createInterface({ input: stdin, output: stdout });
const code = (await rl.question("Paste the code here: ")).trim();
rl.close();

const res = await fetch("https://www.strava.com/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
  }),
});
const json = await res.json();
if (!res.ok) {
  console.error("Exchange failed:", json);
  process.exit(1);
}
console.log(`\nAuthorized athlete: ${json.athlete?.firstname} ${json.athlete?.lastname} (id ${json.athlete?.id})`);
console.log("\nSTRAVA_REFRESH_TOKEN =", json.refresh_token);
console.log("\nSave it as a GitHub Actions secret. Do not commit it.\n");
