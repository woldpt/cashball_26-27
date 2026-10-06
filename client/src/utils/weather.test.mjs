// Paridade com o servidor: a previsão do cliente tem de bater certo com
// `getWeatherForFixture` (lido do .ts — o dist pode estar desatualizado).
// Run: cd client && npm run test:weather
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { transformWithOxc } from "vite";
import { weatherForFixture } from "./weather.js";

const ts = readFileSync(new URL("../../../server/game/matchCalculations.ts", import.meta.url), "utf8");
const fn = ts.match(/export function getWeatherForFixture[\s\S]*?\n\}\n/)?.[0];
assert(fn, "getWeatherForFixture não encontrado no servidor");
const { code } = await transformWithOxc(`const WEATHER_EMOJIS = {};\n${fn}`, "w.ts");
const { getWeatherForFixture } = await import(`data:text/javascript,${encodeURIComponent(code)}`);

for (let season = 1; season <= 3; season += 1)
  for (let mw = 1; mw <= 30; mw += 1)
    for (let a = 1; a <= 40; a += 7)
      for (let b = 2; b <= 40; b += 5)
        assert.equal(weatherForFixture(season, mw, a, b), getWeatherForFixture(season, mw, a, b).condition);
console.log("ok");
