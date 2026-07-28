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
  return {
    ...base,
    api,
    code: 1,
    status: "running",
    msg: "ok",
    message: "ok",
    project: "pubgmhd",
    app_id: "pubgmhd",
    activated: true,
    public_welfare: true,
    token,
    session_id: token,
    encrypted_session_key: token,
    expires_at: "2099-12-31 23:59:59",
    expire_time: "2099-12-31 23:59:59",
    offset_token: token,
    announcement: "",
    command: "",
    command_id: "",
    loading_image_url: "",
    queen_loading_image_url: "",
    uworld: 0,
    gnames: 0,
    phys: 0,
    los: 0,
    ver: "1.37.10",
    data: {
      ...base.data,
      code: 1,
      status: "running",
      project: "pubgmhd",
      activated: true,
      token,
      session_id: token,
      encrypted_session_key: token,
      expires_at: "2099-12-31 23:59:59",
      expire_time: "2099-12-31 23:59:59",
      offset_token: token,
      announcement: "",
      command: "",
      command_id: "",
      uworld: 0,
      gnames: 0,
      phys: 0,
      los: 0,
      ver: "1.37.10"
    }
  };
}

// Queen 网络云验证协议：
// 1) handshake 响应用 masterKey 做 AES-CBC，加外层 HMAC-SHA256(payload)
// 2) 握手之后的 secureRequest 用客户端握手生成的 sessionKey
// 3) V7 客户端把 obfuscate/xor 层改成 identity，所以这里的加密明文直接是普通 JSON
const QUEEN_PASSWORD_HEX = "397126c8a9671a8e46906917926ea5fe";
const QUEEN_SALT = "Queen_MasterKey_Salt_2026";
const QUEEN_CUSTOM_B64 = "neULF0mlIT/QMdJCq678Vx+HuADb2tEjOBkysawS3Kc4PvYWzhRpfgo9rN1Z5GXi";
const STD_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const queenMasterKey = crypto.pbkdf2Sync(
  Buffer.from(QUEEN_PASSWORD_HEX, "utf8"),
  Buffer.from(QUEEN_SALT, "utf8"),
  10000,
  32,
  "sha256"
);
const queenSessions = new Map();
let queenLastSession = null;

function hmacHex(key, text) {
  return crypto.createHmac("sha256", key).update(String(text), "utf8").digest("hex");
}

function aesEncryptCbc(key, iv, plain) {
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([cipher.update(Buffer.isBuffer(plain) ? plain : Buffer.from(String(plain), "utf8")), cipher.final()]);
}

function aesDecryptCbc(key, iv, enc) {
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

function customB64Encode(buf) {
  return Buffer.from(buf).toString("base64").replace(/[A-Za-z0-9+/]/g, ch => QUEEN_CUSTOM_B64[STD_B64.indexOf(ch)]);
}

function customB64Decode(text) {
  const normal = String(text || "").replace(/[A-Za-z0-9+/]/g, ch => {
    const idx = QUEEN_CUSTOM_B64.indexOf(ch);
    return idx >= 0 ? STD_B64[idx] : ch;
  });
  return Buffer.from(normal, "base64");
}

function queenHandshakeEnvelope(body) {
  const iv = crypto.randomBytes(16);
  const jsonText = JSON.stringify(body);
  const cipher = aesEncryptCbc(queenMasterKey, iv, Buffer.from(jsonText, "utf8"));
  const payload = Buffer.concat([iv, cipher]).toString("base64");
  return { payload, signature: hmacHex(queenMasterKey, payload) };
}

function queenSecureEnvelope(body, sessionKey) {
  const key = sessionKey || (queenLastSession && queenLastSession.sessionKey) || queenMasterKey;
  const iv = crypto.randomBytes(16);
  const jsonText = JSON.stringify(body);
  const cipher = aesEncryptCbc(key, iv, Buffer.from(jsonText, "utf8"));
  const packed = Buffer.concat([iv, cipher]);
  const mac16 = crypto.createHmac("sha256", key).update(packed).digest().subarray(0, 16);
  const payload = customB64Encode(Buffer.concat([packed, mac16]));
  return { payload, signature: hmacHex(key, payload) };
}

function decryptQueenHandshakeSessionKey(encryptedSessionKey) {
  const raw = Buffer.from(String(encryptedSessionKey || ""), "base64");
  if (raw.length < 32) throw new Error("encrypted_session_key too short");
  const iv = raw.subarray(0, 16);
  const cipher = raw.subarray(16);
  const plain = aesDecryptCbc(queenMasterKey, iv, cipher).toString("utf8").trim();
  const sessionKey = Buffer.from(plain, "base64");
  if (sessionKey.length !== 32) throw new Error("session key length invalid");
  return { sessionKeyBase64: plain, sessionKey };
}

function getQueenSessionForRequest(body) {
  if (queenLastSession) return queenLastSession;
  if (body && body.session_id && queenSessions.has(body.session_id)) return queenSessions.get(body.session_id);
  for (const session of queenSessions.values()) return session;
  return null;
}

function tryDecryptQueenSecurePayload(body) {
  if (!body || !body.payload) return null;
  const candidates = [];
  if (queenLastSession) candidates.push(queenLastSession);
  for (const session of queenSessions.values()) {
    if (!candidates.includes(session)) candidates.push(session);
  }
  for (const session of candidates) {
    try {
      const key = session.sessionKey;
      if (body.signature && hmacHex(key, body.payload) !== String(body.signature)) continue;
      const raw = customB64Decode(body.payload);
      if (raw.length < 48) continue;
      const packed = raw.subarray(0, raw.length - 16);
      const mac = raw.subarray(raw.length - 16);
      const expect = crypto.createHmac("sha256", key).update(packed).digest().subarray(0, 16);
      if (!crypto.timingSafeEqual(mac, expect)) continue;
      const plain = aesDecryptCbc(key, packed.subarray(0, 16), packed.subarray(16)).toString("utf8");
      return { session, data: JSON.parse(plain) };
    } catch {
      // try next session
    }
  }
  return null;
}

async function collectJsonLoose(req) {
  try {
    return await collectJson(req);
  } catch {
    return {};
  }
}

function queenApiFromPath(pathname) {
  const p = String(pathname || "").toLowerCase();
  if (p.endsWith("/challenge.php") || p.endsWith("/api/challenge.php")) return "handshake";
  if (p.endsWith("/activate_v2.php") || p.endsWith("/api/activate_v2.php")) return "activate";
  if (p.endsWith("/verify_v2.php") || p.endsWith("/api/verify_v2.php")) return "verify";
  if (p.endsWith("/heartbeat_v2.php") || p.endsWith("/api/heartbeat_v2.php")) return "heartbeat";
  if (p.endsWith("/feature_config_v2.php") || p.endsWith("/api/feature_config_v2.php")) return "feature_config";
  return "";
}

function pickKami(body) {
  if (!body || typeof body !== "object") return "";
  return String(
    body.kami || body.card || body.cdkey || body.key || body.license ||
    (body.data && (body.data.kami || body.data.card || body.data.cdkey || body.data.key || body.data.license)) ||
    ""
  ).trim();
}

function pickUdid(body, req) {
  if (!body || typeof body !== "object") body = {};
  return String(
    body.udid || body.device || body.device_id || body.deviceId ||
    (body.data && (body.data.udid || body.data.device || body.data.device_id || body.data.deviceId)) ||
    req.headers["x-device-id"] || "auto-device"
  ).trim();
}

function validateKamiForQueen(body, req) {
  if (AUTO_PASS) return { ok: true, key: null, message: "ok" };
  const kami = pickKami(body);
  const udid = pickUdid(body, req);
  if (!kami) return { ok: false, code: 404, message: "??????" };
  const db = readDb();
  const kamiHash = sha256(kami);
  const key = db.keys[kamiHash];
  if (!key || !key.enabled) return { ok: false, code: 404, message: "??????" };
  if (key.expire_unix <= nowUnix()) return { ok: false, code: 403, message: "??????" };
  key.devices = key.devices || [];
  if (udid && !key.devices.includes(udid)) {
    if (key.devices.length >= Number(key.max_devices || 1)) {
      return { ok: false, code: 403, message: "????????" };
    }
    key.devices.push(udid);
    writeDb(db);
  }
  return { ok: true, key, kami, udid, message: "ok" };
}

function queenFailBody(api, message, code = 404) {
  return {
    api,
    success: false,
    ok: false,
    valid: false,
    authorized: false,
    activated: false,
    code,
    ret: code,
    status: "error",
    msg: message,
    message,
    data: {
      success: false,
      ok: false,
      valid: false,
      authorized: false,
      activated: false,
      code,
      ret: code,
      status: "error",
      msg: message,
      message
    }
  };
}

async function handleQueenApi(req, res, api) {
  const body = await collectJsonLoose(req);
  if (api === "handshake") {
    let sessionKeyBase64 = "";
    let sessionKey = null;
    try {
      const dec = decryptQueenHandshakeSessionKey(body.encrypted_session_key);
      sessionKeyBase64 = dec.sessionKeyBase64;
      sessionKey = dec.sessionKey;
    } catch {
      // 兜底：避免握手失败；正常 V7 会带可解密的 encrypted_session_key
      sessionKey = crypto.randomBytes(32);
      sessionKeyBase64 = sessionKey.toString("base64");
    }
    const sessionId = "queen_" + crypto.randomBytes(12).toString("hex");
    const session = {
      session_id: sessionId,
      sessionKeyBase64,
      sessionKey,
      created_unix: nowUnix(),
      last_api: api
    };
    queenSessions.set(sessionId, session);
    queenLastSession = session;
    return json(res, 200, queenHandshakeEnvelope({
      ...queenSuccessBody(api),
      code: 1,
      msg: "ok",
      message: "ok",
      session_id: sessionId,
      server_time: nowUnix()
    }));
  }

  const decrypted = tryDecryptQueenSecurePayload(body);
  const requestData = (decrypted && decrypted.data) || body || {};
  const session = (decrypted && decrypted.session) || getQueenSessionForRequest(body);
  if (session) {
    session.last_api = api;
    session.last_unix = nowUnix();
  }

  if (api === "activate" || api === "verify") {
    const state = validateKamiForQueen(requestData, req);
    if (!state.ok) {
      return json(res, 200, queenSecureEnvelope(queenFailBody(api, state.message, state.code), session && session.sessionKey));
    }
  }

  const reply = {
    ...queenSuccessBody(api),
    api,
    code: 1,
    msg: "ok",
    message: "ok",
    session_id: session ? session.session_id : "queen_auto",
    server_time: nowUnix()
  };
  return json(res, 200, queenSecureEnvelope(reply, session && session.sessionKey));
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
  const queenApi = url.searchParams.get("api") || queenApiFromPath(url.pathname);

  console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname}${url.search} queenApi=${queenApi || "-"} ip=${req.headers["x-forwarded-for"] || req.socket.remoteAddress || "-"}`);

  if (queenApi) {
    return handleQueenApi(req, res, queenApi);
  }

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



