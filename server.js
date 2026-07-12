const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8787);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me-admin-token";
const AUTO_PASS = process.env.AUTO_PASS !== "0";
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const DEFAULT_FEATURES = {
  radar: true,
  websocket: true,
  hud: true,
  deltaForce: true,
  shadowTracker: true,
  lootMinVal: 0,
  lootMaxVal: 999999,
  showArmorInfo: true,
  showHeroInfo: true,
  showWeaponInfo: true
};

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    writeDb({ keys: {}, sessions: {} });
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": data.length,
    "Cache-Control": "no-store"
  });
  res.end(data);
}

function collectJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid json"));
      }
    });
  });
}

function requireAdmin(req, res) {
  const token = req.headers.authorization || "";
  if (token !== `Bearer ${ADMIN_TOKEN}`) {
    json(res, 401, { success: false, message: "admin token required" });
    return false;
  }
  return true;
}

function getBearer(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice("Bearer ".length).trim();
}

function publicKey(key) {
  return {
    key: key.key,
    enabled: key.enabled,
    expire_unix: key.expire_unix,
    max_devices: key.max_devices,
    devices: key.devices || [],
    features: key.features || DEFAULT_FEATURES,
    note: key.note || ""
  };
}


function autoSuccessBody() {
  const expire = nowUnix() + 3650 * 86400;
  const token = "auto_" + newToken();
  return {
    success: true,
    ok: true,
    valid: true,
    authorized: true,
    result: true,
    code: 0,
    status: 1,
    msg: "ok",
    message: "ok",
    access_token: token,
    token: token,
    token_expire_unix: expire,
    license_expire_unix: expire,
    expire_unix: expire,
    expire: expire,
    vip: true,
    features: DEFAULT_FEATURES,
    data: {
      success: true,
      valid: true,
      authorized: true,
      token: token,
      access_token: token,
      expire_unix: expire,
      features: DEFAULT_FEATURES
    },
    notice_on: false,
    notice_content: ""
  };
}

function validateSession(db, token) {
  const session = db.sessions[token];
  if (!session) return { ok: false, message: "session not found" };
  if (session.expire_unix <= nowUnix()) return { ok: false, message: "session expired" };
  const key = db.keys[session.kami_hash];
  if (!key || !key.enabled) return { ok: false, message: "license disabled" };
  if (key.expire_unix <= nowUnix()) return { ok: false, message: "license expired" };
  return { ok: true, session, key };
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true, service: "recovered-license-api", time: nowUnix() });
  }

  if (req.method === "POST" && url.pathname === "/admin/keys") {
    if (!requireAdmin(req, res)) return;
    const body = await collectJson(req);
    const kami = body.kami || crypto.randomBytes(12).toString("hex").toUpperCase();
    const days = Number(body.days || 7);
    const db = readDb();
    const kamiHash = sha256(kami);
    db.keys[kamiHash] = {
      key: kami,
      enabled: body.enabled !== false,
      created_unix: nowUnix(),
      expire_unix: Number(body.expire_unix || nowUnix() + days * 86400),
      max_devices: Number(body.max_devices || 1),
      devices: [],
      features: body.features || DEFAULT_FEATURES,
      note: body.note || ""
    };
    writeDb(db);
    return json(res, 200, { success: true, license: publicKey(db.keys[kamiHash]) });
  }

  if (req.method === "GET" && url.pathname === "/admin/keys") {
    if (!requireAdmin(req, res)) return;
    const db = readDb();
    const keys = Object.values(db.keys).map(publicKey);
    return json(res, 200, { success: true, keys });
  }

  if (req.method === "POST" && url.pathname === "/admin/keys/disable") {
    if (!requireAdmin(req, res)) return;
    const body = await collectJson(req);
    const db = readDb();
    const hash = sha256(body.kami || "");
    if (!db.keys[hash]) return json(res, 404, { success: false, message: "license not found" });
    db.keys[hash].enabled = false;
    writeDb(db);
    return json(res, 200, { success: true });
  }

  if (req.method === "POST" && (url.pathname === "/api/v1/auth/verify" || url.pathname === "/verify")) {
    const body = await collectJson(req);
    const kami = String(body.kami || body.card || body.license || "AUTO-PASS").trim();
    const udid = String(body.udid || body.device_id || body.device || req.headers["x-device-id"] || "auto-device").trim();
    const bundleId = String(body.bundle_id || body.bundleId || body.bundle || "auto-bundle").trim();

    // ????????????????????????
    if (AUTO_PASS) return json(res, 200, autoSuccessBody());

    if (!kami || !udid) return json(res, 400, { success: false, message: "kami and udid required" });

    const db = readDb();
    const kamiHash = sha256(kami);
    const key = db.keys[kamiHash];
    if (!key || !key.enabled) return json(res, 403, { success: false, message: "invalid license" });
    if (key.expire_unix <= nowUnix()) return json(res, 403, { success: false, message: "license expired" });

    key.devices = key.devices || [];
    if (!key.devices.includes(udid)) {
      if (key.devices.length >= key.max_devices) {
        return json(res, 403, { success: false, message: "device limit reached" });
      }
      key.devices.push(udid);
    }

    const token = newToken();
    db.sessions[token] = {
      token,
      kami_hash: kamiHash,
      udid,
      bundle_id: bundleId,
      created_unix: nowUnix(),
      expire_unix: Math.min(key.expire_unix, nowUnix() + 6 * 3600),
      last_heartbeat_unix: nowUnix()
    };
    writeDb(db);

    return json(res, 200, {
      success: true,
      message: "ok",
      access_token: token,
      token_expire_unix: db.sessions[token].expire_unix,
      license_expire_unix: key.expire_unix,
      features: key.features || DEFAULT_FEATURES,
      notice_on: false,
      notice_content: ""
    });
  }

  if (req.method === "POST" && (url.pathname === "/api/v1/auth/heartbeat" || url.pathname === "/hb")) {
    const token = getBearer(req) || (await collectJson(req)).access_token || "";
    if (AUTO_PASS || token.startsWith("auto_")) {
      const expire = nowUnix() + 3650 * 86400;
      return json(res, 200, { success: true, token_expire_unix: expire, license_expire_unix: expire });
    }
    const db = readDb();
    const state = validateSession(db, token);
    if (!state.ok) return json(res, 401, { success: false, message: state.message });
    state.session.last_heartbeat_unix = nowUnix();
    writeDb(db);
    return json(res, 200, {
      success: true,
      token_expire_unix: state.session.expire_unix,
      license_expire_unix: state.key.expire_unix
    });
  }

  if (req.method === "GET" && (url.pathname === "/api/v1/features" || url.pathname === "/feature")) {
    const token = getBearer(req) || url.searchParams.get("access_token") || "";
    if (AUTO_PASS || token.startsWith("auto_")) {
      return json(res, 200, { success: true, features: DEFAULT_FEATURES });
    }
    const db = readDb();
    const state = validateSession(db, token);
    if (!state.ok) return json(res, 401, { success: false, message: state.message });
    return json(res, 200, { success: true, features: state.key.features || DEFAULT_FEATURES });
  }

  if (req.method === "POST" && (url.pathname === "/api/v1/auth/end" || url.pathname === "/sess/end")) {
    const body = await collectJson(req);
    const token = getBearer(req) || body.access_token || "";
    const db = readDb();
    delete db.sessions[token];
    writeDb(db);
    return json(res, 200, { success: true });
  }

  // AUTO_PASS fallback: return success for any unmatched path.
  if (AUTO_PASS) return json(res, 200, autoSuccessBody());

  return json(res, 404, { success: false, message: "not found" });
}

ensureDb();

http.createServer((req, res) => {
  handle(req, res).catch(err => {
    json(res, 500, { success: false, message: err.message });
  });
}).listen(PORT, () => {
  console.log(`recovered-license-api listening on http://127.0.0.1:${PORT}`);
});
