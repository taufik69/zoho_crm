/**
 * Process entry point: start the HTTP server, wire graceful shutdown and the
 * last-resort error handlers.
 *
 * Unlike the stock scaffold there is nothing to connect before listening —
 * no database, no Redis. Zoho is reached per request, and an unauthorized app
 * must still boot so the OAuth flow at /api/v1/auth/connect can be started.
 *
 * See .claude/skills/backend-scaffold/SKILL.md
 */

import app from "./src/app.js";
import config from "./src/config/env.js";
import { createLogger, flushLogger } from "./src/config/logger.js";

const log = createLogger("server");

const startServer = () => {
  const server = app.listen(config.port, () => {
    log.info(
      `Listening on port http://localhost:${config.port} (${config.nodeEnv})`,
    );
  });

  const shutdown = (signal) => {
    log.info(`${signal} received, shutting down...`);
    server.close(async () => {
      await flushLogger();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

// Last-resort handlers. A rejection or throw that escapes every other path
// would otherwise print Node's own trace to stderr and bypass the logger
// entirely. The process still dies on an uncaught exception: its state is
// unknown after one, so logging and exiting beats limping on.
process.on("unhandledRejection", (reason) => {
  log.error({ err: reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", async (error) => {
  log.fatal({ err: error }, "Uncaught exception, exiting");
  await flushLogger();
  process.exit(1);
});

startServer();
