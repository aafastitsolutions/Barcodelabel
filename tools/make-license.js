const fs = require("fs");
const path = require("path");
const nacl = require("tweetnacl");

function toB64(u8) { return Buffer.from(u8).toString("base64"); }

function sign(payload, secretKey) {
  const payloadJson = JSON.stringify(payload);
  const sig = nacl.sign.detached(Buffer.from(payloadJson, "utf8"), secretKey);
  return { payload, sig: toB64(sig) };
}

const toolsDir = __dirname;
const keysPath = path.join(toolsDir, "keys.json");
const outPath = path.join(toolsDir, "license.json");

if (!fs.existsSync(keysPath)) {
  const kp = nacl.sign.keyPair();
  fs.writeFileSync(keysPath, JSON.stringify({
    publicKeyB64: toB64(kp.publicKey),
    secretKeyB64: toB64(kp.secretKey),
  }, null, 2));
  console.log("Generated tools/keys.json");
  console.log("Run again to generate a license.");
  process.exit(0);
}

const keys = JSON.parse(fs.readFileSync(keysPath, "utf8"));
const secretKey = Buffer.from(keys.secretKeyB64, "base64");

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

function normalizeDurationMonths(value) {
  const n = parseInt(value || "1", 10);
  return [1, 6, 12].includes(n) ? n : 1;
}

function planForDuration(months) {
  if (months === 1) return "PRO_1M";
  if (months === 6) return "PRO_6M";
  return "PRO_12M";
}

const machineId = (process.argv[2] || "").trim();
const customer = (process.argv[3] || "Client Demo SRL").trim();
const durationMonths = normalizeDurationMonths(process.argv[4]);

const payload = {
  customer,
  licenseId: `BLS-${durationMonths}M-${todayISO().replaceAll("-", "")}`,
  plan: planForDuration(durationMonths),
  machineId,
  issuedAt: todayISO(),
  expires: addMonthsISO(durationMonths),
  durationMonths,
  graceDays: 0,
  features: ["ALL"],
  maxLabels: 999999,
};

const lic = sign(payload, secretKey);
fs.writeFileSync(outPath, JSON.stringify(lic, null, 2));
console.log("Wrote tools/license.json");
console.log(`Duration: ${durationMonths} month(s), expires: ${payload.expires}`);
console.log("Public key (paste in src/license.js):", keys.publicKeyB64);
