import { parseCommaList } from "@/lib/rules-directory-filters";

export type RulesDirectorySearch = {
  stacks: string[];
  types: string[];
  classification: "all" | "patterns" | "deps";
  protect: string[];
  layers: string[];
  q: string;
};

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function parseRulesDirectorySearch(
  sp: Record<string, string | string[] | undefined> | undefined
): RulesDirectorySearch {
  if (!sp) {
    return { stacks: [], types: [], classification: "all", protect: [], layers: [], q: "" };
  }
  const stacksRaw = firstString(sp.stacks);
  const legacyStack = firstString(sp.stack);
  let stacks: string[] = [];
  if (stacksRaw) {
    stacks = parseCommaList(stacksRaw);
  } else if (legacyStack) {
    stacks = [legacyStack.trim()].filter(Boolean);
  }
  const classRaw = (firstString(sp.class) ?? "").trim().toLowerCase();
  const classification: RulesDirectorySearch["classification"] =
    classRaw === "patterns" ? "patterns" : classRaw === "deps" ? "deps" : "all";
  return {
    stacks,
    types: parseCommaList(firstString(sp.types)),
    classification,
    protect: parseCommaList(firstString(sp.protect)),
    layers: parseCommaList(firstString(sp.layers)),
    q: (firstString(sp.q) ?? "").trim(),
  };
}

export function buildRulesDirectoryHref(current: RulesDirectorySearch, patch: Partial<RulesDirectorySearch>): string {
  const next: RulesDirectorySearch = {
    stacks: patch.stacks !== undefined ? patch.stacks : current.stacks,
    types: patch.types !== undefined ? patch.types : current.types,
    classification: patch.classification !== undefined ? patch.classification : current.classification,
    protect: patch.protect !== undefined ? patch.protect : current.protect,
    layers: patch.layers !== undefined ? patch.layers : current.layers,
    q: patch.q !== undefined ? patch.q : current.q,
  };
  const p = new URLSearchParams();
  if (next.stacks.length) p.set("stacks", next.stacks.join(","));
  if (next.types.length) p.set("types", next.types.join(","));
  if (next.classification !== "all") p.set("class", next.classification);
  if (next.protect.length) p.set("protect", next.protect.join(","));
  if (next.layers.length) p.set("layers", next.layers.join(","));
  if (next.q) p.set("q", next.q);
  const s = p.toString();
  return s ? `/rules?${s}` : "/rules";
}

export function toggleLayerInSearch(current: RulesDirectorySearch, slug: string): string {
  const set = new Set(current.layers);
  if (set.has(slug)) set.delete(slug);
  else set.add(slug);
  return buildRulesDirectoryHref(current, { layers: [...set] });
}

export function toggleStackInSearch(current: RulesDirectorySearch, slug: string): string {
  const set = new Set(current.stacks);
  if (set.has(slug)) set.delete(slug);
  else set.add(slug);
  return buildRulesDirectoryHref(current, { stacks: [...set] });
}

export function toggleListValue(current: RulesDirectorySearch, key: "types" | "protect", value: string): string {
  const arr = [...current[key]];
  const i = arr.indexOf(value);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(value);
  return buildRulesDirectoryHref(current, { [key]: arr });
}

export function setClassification(current: RulesDirectorySearch, classification: RulesDirectorySearch["classification"]): string {
  return buildRulesDirectoryHref(current, { classification });
}
