import fs from "fs";
import path from "path";

const FIXTURES = path.join(process.cwd(), "db", "fixtures", "all_teams.json");

export interface TeamEntry {
  name: string;
  division: number;
  skillRange: [number, number];
  colors: { primary: string; secondary: string };
  stadium: { name: string; capacity: number };
  manager: { name: string; photo?: string | null; zerozeroId?: number | null };
  crest?: string | null;
  colors_secondary?: string;
  zerozeroUrl?: string;
  players: Array<{ name: string; country: string; position: string; age: number | null; zerozeroId?: number | null; photo?: string | null }>;
}

export function loadTeams(): { teams: TeamEntry[] } {
  return JSON.parse(fs.readFileSync(FIXTURES, "utf-8"));
}

export function saveTeams(data: { teams: TeamEntry[] }) {
  fs.writeFileSync(FIXTURES, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

export function parseZerozeroUrl(input: string): string | null {
  // aceita https://www.zerozero.pt/equipa/xxx/123?search=1 ou /equipa/xxx/123
  const m = input.trim().match(/(?:https?:\/\/[^/]+)?(\/equipa\/[a-z0-9-]+\/?[0-9]*\??[^ ]*)/i);
  if (!m) return null;
  let u = m[1].trim();
  // garante /equipa prefix
  if (!u.startsWith("/equipa/")) return null;
  return u;
}

export function teamLabel(t: TeamEntry, idx: number): string {
  return `D${t.division} · ${t.name} (${t.players.length} jogadores)`;
}
