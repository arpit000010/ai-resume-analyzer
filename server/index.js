const app = require("./app");
const { port, host } = require("./config").serverConfig();
const server = app.listen(port, host, () => {
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
