const net = require("net");
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");

const PG_PORT = 5433;
const PG_DATA = "C:\\Users\\navtej\\.gemini\\antigravity-ide\\brain\\bb19e135-44a2-4999-8109-b52c1ffbe72a\\scratch\\pgdata";
const PG_LOG = "C:\\Users\\navtej\\.gemini\\antigravity-ide\\brain\\bb19e135-44a2-4999-8109-b52c1ffbe72a\\scratch\\pg.log";
const PG_CTL = "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_ctl.exe";

function checkPort(port, host = "127.0.0.1", timeout = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeout);
    socket.once("connect", () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("error", () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function ensureDb() {
  const isRunning = await checkPort(PG_PORT);
  if (isRunning) {
    console.log(`[BuildMate DB] PostgreSQL is already running on port ${PG_PORT}.`);
    return;
  }

  console.log(`[BuildMate DB] PostgreSQL on port ${PG_PORT} is not running. Starting database...`);

  // Remove stale postmaster.pid if present
  const pidFile = path.join(PG_DATA, "postmaster.pid");
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
      console.log(`[BuildMate DB] Cleaned up stale postmaster.pid`);
    } catch (e) {
      console.warn(`[BuildMate DB] Note: Could not remove pid file: ${e.message}`);
    }
  }

  // Start PostgreSQL via pg_ctl
  try {
    const args = [
      "-D", PG_DATA,
      "-l", PG_LOG,
      "-o", `-p ${PG_PORT}`,
      "start"
    ];

    const child = spawn(PG_CTL, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();

    // Poll until ready (up to 10 seconds)
    const startTime = Date.now();
    while (Date.now() - startTime < 10000) {
      await new Promise((r) => setTimeout(r, 500));
      const ready = await checkPort(PG_PORT);
      if (ready) {
        console.log(`[BuildMate DB] PostgreSQL successfully started and listening on port ${PG_PORT}.`);
        return;
      }
    }

    console.warn(`[BuildMate DB] Warning: PostgreSQL did not respond on port ${PG_PORT} within 10s. Check ${PG_LOG}`);
  } catch (err) {
    console.error(`[BuildMate DB] Error launching PostgreSQL:`, err);
  }
}

if (require.main === module) {
  ensureDb().catch(console.error);
}

module.exports = { ensureDb, checkPort };
