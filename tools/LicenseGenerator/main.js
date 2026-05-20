const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const nacl = require("tweetnacl");

function createWindow(){
  const win = new BrowserWindow({
    width: 860,
    height: 760,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  win.loadFile(path.join(__dirname, "index.html"));
}

function readKeys(keysPath){
  const raw = fs.readFileSync(keysPath, "utf8");
  const obj = JSON.parse(raw);
  if (!obj.secretKeyB64) throw new Error("keys.json nu are secretKeyB64");
  if (!obj.publicKeyB64) throw new Error("keys.json nu are publicKeyB64");
  return obj;
}

function addYearsISO(dateISO, years){
  const d = new Date(dateISO + "T00:00:00");
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0,10);
}

function addMonthsISO(dateISO, months){
  const d = new Date(dateISO + "T00:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().slice(0,10);
}

function normalizeDurationMonths(value){
  const n = parseInt(value || "12", 10);
  return [1, 6, 12].includes(n) ? n : 12;
}

function planForDuration(months){
  if (months === 1) return "PRO_1M";
  if (months === 6) return "PRO_6M";
  return "PRO_12M";
}

ipcMain.handle("keys:load", async () => {
  const keysPath = path.join(__dirname, "..", "keys.json");
  if (!fs.existsSync(keysPath)) return { ok:false, reason:"missing_keys", keysPath };
  try {
    const keys = readKeys(keysPath);
    return { ok:true, publicKeyB64: keys.publicKeyB64, keysPath };
  } catch(e){
    return { ok:false, reason: e.message, keysPath };
  }
});

ipcMain.handle("license:generate", async (event, payload) => {
  const keysPath = path.join(__dirname, "..", "keys.json");
  if (!fs.existsSync(keysPath)) throw new Error("Nu găsesc tools/keys.json (rulează make-keys în proiectul principal).");
  const keys = readKeys(keysPath);
  const secret = Buffer.from(keys.secretKeyB64, "base64");

  const issuedAt = payload.issuedAt;
  const durationMonths = normalizeDurationMonths(payload.durationMonths);
  const years = parseInt(payload.years || "1", 10) || 1;
  const expires = payload.expiresOverride || (payload.durationMonths ? addMonthsISO(issuedAt, durationMonths) : addYearsISO(issuedAt, years));

  const p = {
    customer: payload.customer || "",
    licenseId: payload.licenseId || "",
    plan: payload.plan || planForDuration(durationMonths),
    machineId: payload.machineId || "",
    issuedAt,
    expires,
    durationMonths,
    graceDays: parseInt(payload.graceDays || "0", 10) || 0,
    features: payload.features || ["ALL"],
    maxLabels: 999999,
    renewalOf: payload.renewalOf || ""
  };

  const msg = Buffer.from(JSON.stringify(p), "utf8");
  const sig = nacl.sign.detached(msg, secret);
  const lic = { payload: p, sig: Buffer.from(sig).toString("base64") };

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Salvează license.json",
    defaultPath: "license.json",
    filters: [{ name: "License", extensions: ["json"] }]
  });
  if (canceled || !filePath) return { ok:false, reason:"canceled" };

  fs.writeFileSync(filePath, JSON.stringify(lic, null, 2), "utf8");
  return { ok:true, filePath, license: lic, publicKeyB64: keys.publicKeyB64 };
});

app.whenReady().then(createWindow);
