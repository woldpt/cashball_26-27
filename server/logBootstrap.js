const LOG_METHODS = ["log", "info", "warn", "error", "debug"];

// Avoid patching console multiple times when this module is required by different files.
if (!global.__cashballConsolePatched) {
  const formatter = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const timestamp = () => formatter.format(new Date()).replace(",", "");

  for (const method of LOG_METHODS) {
    if (typeof console[method] !== "function") continue;
    const original = console[method].bind(console);
    console[method] = (...args) => {
      original(`[${timestamp()}]`, ...args);
    };
  }

  global.__cashballConsolePatched = true;
}
