/**
 * Sentry initialization for the Cashball backend.
 *
 * Only initializes if SENTRY_DSN is set in the environment.
 * Without a DSN, this module is a no-op (zero overhead).
 *
 * Setup:
 *   1. Create a project at https://sentry.io → get DSN
 *   2. Add to server/.env: SENTRY_DSN=https://xxx@o0.ingest.sentry.io/0
 *   3. Restart the container
 */

const SENTRY_DSN = process.env.SENTRY_DSN;

if (!SENTRY_DSN) {
  // No DSN → module is inert. Export no-ops so imports don't break.
  module.exports = {
    init: () => {},
    captureException: (e) => console.error("[sentry:disabled]", e),
    captureMessage: (m) => console.warn("[sentry:disabled]", m),
    withScope: (fn) => fn({ setTag: () => {}, setExtra: () => {} }),
    SDK: { name: "disabled" },
  };
  return;
}

const Sentry = require("@sentry/node");

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.NODE_ENV || "production",
  release: process.env.GIT_COMMIT || undefined,
  // Don't send console logs to Sentry (we have our own logBootstrap)
  denyUrls: [/localhost/],
});

// Capture unhandled errors that would otherwise crash the process silently
process.on("unhandledRejection", (reason) => {
  console.error("[sentry] unhandledRejection:", reason);
  Sentry.captureException(reason);
});

process.on("uncaughtException", (err) => {
  console.error("[sentry] uncaughtException:", err);
  Sentry.captureException(err);
  // Give Sentry time to flush before exit
  setTimeout(() => process.exit(1), 2000);
});

module.exports = Sentry;
