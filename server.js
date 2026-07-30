const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8787);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me-admin-token";
const AUTO_PASS = process.env.AUTO_PASS !== "0";
const SERVER_VERSION = "QueenHybridV12_PLAIN_FOR_PLAIN_V2_20260730";
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
    "Cache-Control": "no-store",
    "X-Queen-Server-Version": SERVER_VERSION
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

function autoSuccessBody() {
  const expire = nowUnix() + 3650 * 86400;
  const expireMs = expire * 1000;
  const token = "auto_" + newToken();
  return {
    success: true,
    ok: true,
    valid: true,
    authorized: true,
    result: true,
    pass: true,
    is_vip: true,
    vip: true,
    enable: true,
    enabled: true,
    code: 0,
    ret: 0,
    err: 0,
    errno: 0,
    status: 1,
    state: 1,
    msg: "ok",
    message: "ok",
    reason: "ok",
    access_token: token,
    accessToken: token,
    session: token,
    session_id: token,
    sessionId: token,
    token: token,
    auth_token: token,
    authToken: token,
    token_expire_unix: expire,
    tokenExpireUnix: expire,
    token_expire: expire,
    license_expire_unix: expire,
    licenseExpireUnix: expire,
    license_expire: expire,
    expire_unix: expire,
    expireUnix: expire,
    expire: expire,
    expires: expire,
    expired_at: expire,
    expire_time: expire,
    endtime: expire,
    end_time: expire,
    due_time: expire,
    timestamp: nowUnix(),
    server_time: nowUnix(),
    time: nowUnix(),
    ttl: 3650 * 86400,
    remain: 3650 * 86400,
    remaining: 3650 * 86400,
    expire_ms: expireMs,
    expireTime: expireMs,
    features: DEFAULT_FEATURES,
    config: DEFAULT_FEATURES,
    permissions: DEFAULT_FEATURES,
    data: {
      success: true,
      ok: true,
      valid: true,
      authorized: true,
      pass: true,
      code: 0,
      ret: 0,
      status: 1,
      token: token,
      access_token: token,
      accessToken: token,
      session: token,
      session_id: token,
      expire_unix: expire,
      expireUnix: expire,
      expire: expire,
      expires: expire,
      endtime: expire,
      end_time: expire,
      token_expire_unix: expire,
      license_expire_unix: expire,
      features: DEFAULT_FEATURES
    },
    user: {
      vip: true,
      expire_unix: expire,
      token: token
    },
    notice_on: false,
    notice_content: "",
    notice: "",
    title: "",
    content: ""
  };
}

function queenSuccessBody(api = "check") {
  const expire = nowUnix() + 3650 * 86400;
  const token = "auto_" + newToken();
  const base = autoSuccessBody();
  const challengeId = "queen_auto";

  const queenFeatureData = {
    esp_enabled: true,
    enabled: true,
    ready: true,
    cfg_ver: "1",
    cfg: {
      esp_enabled: true,
      enabled: true,
      ready: true,
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
    },
    fc: DEFAULT_FEATURES,
    feature_config: DEFAULT_FEATURES,
    features: DEFAULT_FEATURES,
    fcfg_ok: true,
    feature_ready: true
  };

  return {
    ...base,
    api,
    code: 1,
    status: "running",
    msg: "ok",
    message: "ok",
    project: "pubgmhd",
    app_id: "pubgmhd",
    activated
