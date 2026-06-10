import type { components } from "@aigently/api-client";

/**
 * Widens the generated Threat type with optional EPSS fields that are not yet
 * in the OpenAPI spec but are already present in the DB. Remove this file and
 * import directly from @aigently/api-client once the spec is regenerated.
 */
export type Threat = components["schemas"]["Threat"] & {
  epssScore?: number | null;
  epssPercentile?: number | null;
};
