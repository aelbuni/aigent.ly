export type RuleType = "patterns" | "deps" | "both";

export interface DetectResult {
  stacks: string[];
  ruleType: RuleType;
}

const STACK_SIGNALS: Record<string, string[]> = {
  nextjs:      ["next.js", "nextjs", "next/", "app router", "server action", "server component", "pages/api", "use client", "use server"],
  express:     ["express", "req, res", "app.get(", "app.post(", "router.", "express()"],
  fastapi:     ["fastapi", "uvicorn", "@app.get", "@app.post", "@router", "pydantic"],
  nestjs:      ["nestjs", "nest.js", "@controller", "@injectable", "@module", "@get(", "@post("],
  nuxt:        ["nuxt", "defineeventhandler", "usefetch", "useasyncdata", "nuxt.config"],
  "react-spa": ["react", "vite", "create-react-app", "usestate(", "useeffect(", "jsx", "tsx"],
};

const PATTERNS_SIGNALS = [
  "implement", "build", "add", "create", "write", "auth", "upload",
  "fetch", "route", "api", "middleware", "form", "validate", "sanitize",
  "secure", "security", "login", "token", "session", "cookie", "header",
  "redirect", "cors", "csrf", "xss", "injection", "permission", "access",
];

const DEPS_SIGNALS = [
  "install", "npm install", "package", "dependency", "upgrade",
  "library", "import", "use library", "yarn add", "pnpm add",
  "update", "version", "module",
];

export function detectContext(
  intent: string,
  filePath?: string,
  explicitStacks?: string[]
): DetectResult {
  const haystack = `${intent} ${filePath ?? ""}`.toLowerCase();

  // Stack detection
  const detectedStacks: string[] = explicitStacks?.length
    ? explicitStacks
    : Object.entries(STACK_SIGNALS)
        .filter(([, signals]) => signals.some(s => haystack.includes(s)))
        .map(([slug]) => slug);

  // Rule type detection
  const hasPatterns = PATTERNS_SIGNALS.some(s => haystack.includes(s));
  const hasDeps     = DEPS_SIGNALS.some(s => haystack.includes(s));

  let ruleType: RuleType;
  if (hasPatterns && hasDeps) ruleType = "both";
  else if (hasDeps)           ruleType = "deps";
  else                        ruleType = "patterns"; // default: coding context

  return { stacks: detectedStacks, ruleType };
}
