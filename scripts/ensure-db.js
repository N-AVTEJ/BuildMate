const net = require("net");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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
    console.log(`[BuildMate DB] PostgreSQL is already running and accepting connections on port ${PG_PORT}.`);
    return true;
  }

  console.log(`[BuildMate DB] PostgreSQL on port ${PG_PORT} is not running. Ensuring clean state...`);

  // Check if stale postmaster.pid exists
  const pidFile = path.join(PG_DATA, "postmaster.pid");
  if (fs.existsSync(pidFile)) {
    try {
      const pidContent = fs.readFileSync(pidFile, "utf8");
      const pid = parseInt(pidContent.split("\n")[0].trim(), 10);
      let isAlive = false;
      if (pid && !isNaN(pid)) {
        try {
          process.kill(pid, 0);
          isAlive = true;
        } catch {
          isAlive = false;
        }
      }
      if (!isAlive) {
        fs.unlinkSync(pidFile);
        console.log(`[BuildMate DB] Cleaned up stale postmaster.pid (dead PID ${pid}).`);
      } else {
        console.log(`[BuildMate DB] Note: PID ${pid} is still active, waiting for it to respond.`);
      }
    } catch (e) {
      console.warn(`[BuildMate DB] Note: Could not check pid file: ${e.message}`);
    }
  }

  // Start PostgreSQL via Windows PowerShell Start-Process with -WindowStyle Hidden
  // This detaches PostgreSQL completely from console signals (Ctrl+C / terminal exit)
  try {
    const escapedData = PG_DATA.replace(/\\/g, "\\\\");
    const escapedLog = PG_LOG.replace(/\\/g, "\\\\");
    const psCmd = `powershell -NoProfile -Command "Start-Process -FilePath '${PG_CTL}' -ArgumentList 'start -D \\\"${escapedData}\\\" -l \\\"${escapedLog}\\\" -o \\\"-p ${PG_PORT}\\\"' -WindowStyle Hidden"`;
    
    execSync(psCmd, { stdio: "ignore" });

    // Poll until ready (up to 12 seconds)
    const startTime = Date.now();
    while (Date.now() - startTime < 12000) {
      await new Promise((r) => setTimeout(r, 600));
      const ready = await checkPort(PG_PORT);
      if (ready) {
        console.log(`[BuildMate DB] PostgreSQL successfully started and listening on port ${PG_PORT}.`);
        return true;
      }
    }

    console.warn(`[BuildMate DB] Warning: PostgreSQL did not respond on port ${PG_PORT} within timeout. Check ${PG_LOG}`);
    return false;
  } catch (err) {
    console.error(`[BuildMate DB] Error launching PostgreSQL:`, err);
    return false;
  }
}

if (require.main === module) {
  ensureDb().catch(console.error);
}

module.exports = { ensureDb, checkPort };
