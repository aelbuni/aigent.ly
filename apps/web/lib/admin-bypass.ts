// ADMIN_BYPASS is explicitly forbidden in production — NODE_ENV guard is intentional.
export const ADMIN_BYPASS =
  process.env.ADMIN_BYPASS === "true" &&
  process.env.NODE_ENV !== "production";
