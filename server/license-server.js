const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nacl = require("tweetnacl");

const PORT = parseInt(process.env.PORT || process.env.LICENSE_SERVER_PORT || "8787", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const LICENSE_SECRET_KEY_B64 = process.env.BLS_LICENSE_SECRET_KEY_B64 || "";
const LEMON_WEBHOOK_SECRET = process.env.LEMON_WEBHOOK_SECRET || "";
const DEFAULT_LICENSE_MONTHS = parseInt(process.env.DEFAULT_LICENSE_MONTHS || "12", 10);
const LICENSE_GRACE_DAYS = parseInt(process.env.LICENSE_GRACE_DAYS || "0", 10);
const DATA_DIR = path.resolve(process.env.LICENSE_DATA_DIR || path.join(__dirname, "data"));
const ACTIVATIONS_PATH = path.join(DATA_DIR, "activations.json");
const WEBHOOK_LOG_PATH = path.join(DATA_DIR, "webhooks.ndjson");

function parseJsonEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Invalid ${name}: ${err.message}`);
    return fallback;
  }
}

const VARIANT_MONTHS = parseJsonEnv("LEMON_VARIANT_MONTHS_JSON", {});
const VARIANT_PLANS = parseJsonEnv("LEMON_VARIANT_PLANS_JSON", {});

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readActivations() {
  ensureDataDir();
  if (!fs.existsSync(ACTIVATIONS_PATH)) return { keys: {} };
  try {
    return JSON.parse(fs.readFileSync(ACTIVATIONS_PATH, "utf8"));
  } catch {
    return { keys: {} };
  }
}

function writeActivations(data) {
  ensureDataDir();
  fs.writeFileSync(ACTIVATIONS_PATH, JSON.stringify(data, null, 2));
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addMonthsISO(months) {
  const d = new Date();
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

function dateOnly(value) {
  if (!value) return "";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function planForMonths(months) {
  if (months === 1) return "PRO_1M";
  if (months === 6) return "PRO_6M";
  return "PRO_12M";
}

function monthsFromActivation(data) {
  const variantId = String(data && data.meta && data.meta.variant_id ? data.meta.variant_id : "");
  const mapped = parseInt(VARIANT_MONTHS[variantId] || "", 10);
  if ([1, 6, 12].includes(mapped)) return mapped;
  if ([1, 6, 12].includes(DEFAULT_LICENSE_MONTHS)) return DEFAULT_LICENSE_MONTHS;
  return 12;
}

function planFromActivation(data, months) {
  const variantId = String(data && data.meta && data.meta.variant_id ? data.meta.variant_id : "");
  return VARIANT_PLANS[variantId] || planForMonths(months);
}

function signLicense(payload) {
  if (!LICENSE_SECRET_KEY_B64) {
    throw new Error("BLS_LICENSE_SECRET_KEY_B64 lipseste din environment.");
  }
  const secretKey = Buffer.from(LICENSE_SECRET_KEY_B64, "base64");
  const payloadJson = JSON.stringify(payload);
  const sig = nacl.sign.detached(Buffer.from(payloadJson, "utf8"), secretKey);
  return { payload, sig: Buffer.from(sig).toString("base64") };
}

function licenseFromLemon(data, machineId, requestedEmail) {
  const months = monthsFromActivation(data);
  const expiresFromLemon = dateOnly(data && data.license_key && data.license_key.expires_at);
  const meta = (data && data.meta) || {};
  const licenseKey = (data && data.license_key) || {};
  const instance = (data && data.instance) || {};
  const expires = expiresFromLemon || addMonthsISO(months);

  const payload = {
    customer: meta.customer_name || meta.customer_email || requestedEmail || "Lemon Squeezy customer",
    customerEmail: meta.customer_email || requestedEmail || "",
    licenseId: `LS-${licenseKey.id || sha256(licenseKey.key).slice(0, 10)}-${todayISO().replaceAll("-", "")}`,
    plan: planFromActivation(data, months),
    machineId,
    issuedAt: todayISO(),
    expires,
    durationMonths: months,
    graceDays: Number.isFinite(LICENSE_GRACE_DAYS) ? LICENSE_GRACE_DAYS : 0,
    features: ["ALL"],
    maxLabels: 999999,
    source: "lemonsqueezy",
    lemon: {
      licenseKeyId: licenseKey.id || null,
      orderId: meta.order_id || null,
      orderItemId: meta.order_item_id || null,
      productId: meta.product_id || null,
      productName: meta.product_name || "",
      variantId: meta.variant_id || null,
      variantName: meta.variant_name || "",
      customerId: meta.customer_id || null,
      instanceId: instance.id || null
    }
  };

  return signLicense(payload);
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Signature, X-Event-Name"
  });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request prea mare."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function lemonLicenseRequest(action, params) {
  const body = new URLSearchParams(params);
  const response = await fetch(`https://api.lemonsqueezy.com/v1/licenses/${action}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { error: text || "Raspuns Lemon Squeezy invalid." };
  }
  json._httpStatus = response.status;
  return json;
}

function emailMatches(expected, actual) {
  if (!expected) return true;
  if (!actual) return true;
  return String(expected).trim().toLowerCase() === String(actual).trim().toLowerCase();
}

function assertValidLicenseResponse(data) {
  const status = data && data.license_key && data.license_key.status;
  if (status === "expired" || status === "disabled") {
    throw new Error(`Licenta Lemon Squeezy este ${status}.`);
  }
}

async function handleActivate(req, res) {
  if (!LICENSE_SECRET_KEY_B64) {
    return sendJson(res, 500, { ok: false, message: "Serverul nu are configurata cheia privata de semnare." });
  }

  const raw = await readBody(req);
  const input = JSON.parse(raw.toString("utf8") || "{}");
  const licenseKey = String(input.licenseKey || input.license_key || "").trim();
  const machineId = String(input.machineId || input.machine_id || "").trim();
  const email = String(input.email || "").trim();

  if (!licenseKey) return sendJson(res, 400, { ok: false, message: "Cheia Lemon Squeezy lipseste." });
  if (!machineId) return sendJson(res, 400, { ok: false, message: "Machine ID lipseste." });

  const activations = readActivations();
  const licenseHash = sha256(licenseKey);
  const machineHash = sha256(machineId);
  const existing = activations.keys[licenseHash] && activations.keys[licenseHash].machines[machineHash];

  let lemonData;
  if (existing && existing.instanceId) {
    lemonData = await lemonLicenseRequest("validate", {
      license_key: licenseKey,
      instance_id: existing.instanceId
    });
    if (!lemonData.valid) {
      return sendJson(res, 403, { ok: false, message: lemonData.error || "Licenta nu mai este valida." });
    }
    assertValidLicenseResponse(lemonData);
  } else {
    const validation = await lemonLicenseRequest("validate", { license_key: licenseKey });
    if (!validation.valid) {
      return sendJson(res, 403, { ok: false, message: validation.error || "Cheia Lemon Squeezy nu este valida." });
    }
    assertValidLicenseResponse(validation);
    if (!emailMatches(email, validation.meta && validation.meta.customer_email)) {
      return sendJson(res, 403, { ok: false, message: "Emailul nu corespunde cu achizitia Lemon Squeezy." });
    }

    lemonData = await lemonLicenseRequest("activate", {
      license_key: licenseKey,
      instance_name: `Barcode Label Studio - ${machineId.slice(0, 12)}`
    });
    if (!lemonData.activated) {
      return sendJson(res, 403, { ok: false, message: lemonData.error || "Activarea Lemon Squeezy a esuat." });
    }
    assertValidLicenseResponse(lemonData);

    if (!activations.keys[licenseHash]) activations.keys[licenseHash] = { machines: {} };
    activations.keys[licenseHash].machines[machineHash] = {
      machineId,
      instanceId: lemonData.instance && lemonData.instance.id,
      lemonLicenseKeyId: lemonData.license_key && lemonData.license_key.id,
      customerEmail: lemonData.meta && lemonData.meta.customer_email,
      firstActivatedAt: new Date().toISOString(),
      lastActivatedAt: new Date().toISOString()
    };
    writeActivations(activations);
  }

  const license = licenseFromLemon(lemonData, machineId, email);
  return sendJson(res, 200, {
    ok: true,
    message: "Licenta activata.",
    license,
    expires: license.payload.expires,
    plan: license.payload.plan
  });
}

function verifyWebhookSignature(rawBody, signature) {
  if (!LEMON_WEBHOOK_SECRET) return false;
  const digest = crypto.createHmac("sha256", LEMON_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(String(signature || ""), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function summarizeWebhook(eventName, body) {
  const data = body && dataOrNull(body.data);
  const attrs = (data && data.attributes) || {};
  return {
    receivedAt: new Date().toISOString(),
    eventName,
    dataType: data && data.type,
    dataId: data && data.id,
    status: attrs.status || "",
    orderId: attrs.order_id || attrs.first_order_item && attrs.first_order_item.order_id || "",
    productId: attrs.product_id || "",
    variantId: attrs.variant_id || "",
    customerId: attrs.customer_id || "",
    customerEmail: attrs.user_email || attrs.customer_email || "",
    renewsAt: attrs.renews_at || "",
    endsAt: attrs.ends_at || ""
  };
}

function dataOrNull(value) {
  return value && typeof value === "object" ? value : null;
}

async function handleWebhook(req, res) {
  const raw = await readBody(req);
  const signature = req.headers["x-signature"];
  if (!verifyWebhookSignature(raw, signature)) {
    return sendJson(res, 401, { ok: false, message: "Semnatura webhook invalida." });
  }

  const body = JSON.parse(raw.toString("utf8") || "{}");
  const eventName = String(req.headers["x-event-name"] || (body.meta && body.meta.event_name) || "unknown");
  ensureDataDir();
  fs.appendFileSync(WEBHOOK_LOG_PATH, JSON.stringify(summarizeWebhook(eventName, body)) + "\n");
  return sendJson(res, 200, { ok: true });
}

async function route(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
      return sendJson(res, 200, { ok: true, service: "barcode-label-license-server" });
    }
    if (req.method === "POST" && url.pathname === "/api/activate") {
      return await handleActivate(req, res);
    }
    if (req.method === "POST" && url.pathname === "/api/webhooks/lemonsqueezy") {
      return await handleWebhook(req, res);
    }
    return sendJson(res, 404, { ok: false, message: "Endpoint necunoscut." });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { ok: false, message: err.message || "Eroare server." });
  }
}

http.createServer(route).listen(PORT, () => {
  console.log(`Barcode Label Studio license server listening on port ${PORT}`);
});
