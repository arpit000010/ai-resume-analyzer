const express = require("express");
const cors = require("cors");
const analyzeRoutes = require("./routes/analyzeRoutes");
const AppError = require("./utils/AppError");
const { semanticHealth } = require("./services/semanticMatcher");
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
  next();
});
const { clientOrigins: origins } = require("./config").serverConfig();
app.use(cors({
  origin(origin, callback) {
    callback(origin && !origins.includes(origin) ? new AppError(403, "ORIGIN_NOT_ALLOWED", "This browser origin is not allowed.") : null, true);
  },
  methods: ["GET", "POST"],
}));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.get("/api/health/semantic", async (req, res) => {
  const result = await semanticHealth();
  res.status(result.status === "ready" ? 200 : 503).json(result);
});
app.use("/api/analyze", analyzeRoutes);
app.use((req, res, next) => next(new AppError(404, "NOT_FOUND", "Endpoint not found.")));
app.use(require("./middleware/errorHandler"));

module.exports = app;
