const app = require("./app");
const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
const server = app.listen(port, process.env.HOST || "127.0.0.1", () => {
  console.log(`Resume analyzer listening on port ${port}`);
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 15000).unref();
  });
}
