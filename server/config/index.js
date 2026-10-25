function serverConfig() {
  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
  return { port, host: process.env.HOST || "127.0.0.1",
    clientOrigins: (process.env.CLIENT_ORIGINS || "http://localhost:5173").split(",").map((origin) => origin.trim()) };
}
function semanticConfig() {
  const url = new URL(process.env.NLP_SERVICE_URL || "http://127.0.0.1:8000");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("Invalid NLP URL");
  const timeout = Number(process.env.NLP_TIMEOUT_MS || 8000);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 15000) throw new Error("Invalid NLP timeout");
  return { base: url.href.replace(/\/$/, ""), timeout };
}

module.exports = { serverConfig, semanticConfig };
