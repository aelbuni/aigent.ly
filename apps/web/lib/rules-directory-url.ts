import { parseCommaList } from "@/lib/rules-directory-filters";

export type RulesDirectorySearch = {
  stacks: string[];
  types: string[];
  protect: string[];
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
    return { stacks: [], types: [], protect: [], q: "" };
  }
  const stacksRaw = firstString(sp.stacks);
  const legacyStack = firstString(sp.stack);
  let stacks: string[] = [];
  if (stacksRaw) {
    stacks = parseCommaList(stacksRaw);
  } else if (legacyStack) {
    stacks = [legacyStack.trim()].filter(Boolean);
  }
  return {
    stacks,
    types: parseCommaList(firstString(sp.types)),
    protect: parseCommaList(firstString(sp.protect)),
    q: (firstString(sp.q) ?? "").trim(),
  };
}

export function buildRulesDirectoryHref(current: RulesDirectorySearch, patch: Partial<RulesDirectorySearch>): string {
  const next: RulesDirectorySearch = {
    stacks: patch.stacks !== undefined ? patch.stacks : current.stacks,
    types: patch.types !== undefined ? patch.types : current.types,
    protect: patch.protect !== undefined ? patch.protect : current.protect,
    q: patch.q !== undefined ? patch.q : current.q,
  };
  const p = new URLSearchParams();
  if (next.stacks.length) p.set("stacks", next.stacks.join(","));
  if (next.types.length) p.set("types", next.types.join(","));
  if (next.protect.length) p.set("protect", next.protect.join(","));
  if (next.q) p.set("q", next.q);
  const s = p.toString();
  return s ? `/rules?${s}` : "/rules";
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
