const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const nacl = require('tweetnacl');

function canonicalStringify(obj) {
  const keys = Object.keys(obj).sort();
  return JSON.stringify(obj, keys);
}

function loadKeys() {
  const keysPath = path.join(__dirname, 'keys.json');
  if (!fs.existsSync(keysPath)) {
    throw new Error('Nu găsesc tools/keys.json. Rulează mai întâi: npm run make-keys');
  }
  const keys = JSON.parse(fs.readFileSync(keysPath, 'utf-8'));
  if (!keys.secretKeyB64) throw new Error('keys.json nu conține secretKeyB64');
  const secretKey = Buffer.from(keys.secretKeyB64, 'base64');
  if (secretKey.length !== 64) throw new Error('secretKeyB64 trebuie să fie 64 bytes (base64).');
  return { secretKey: new Uint8Array(secretKey) };
}

function makeLicenseObject(payload, secretKeyU8) {
  // IMPORTANT: aplicația verifică semnătura peste JSON.stringify(payload) (fără sortare),
  // dar ca să fie stabil, păstrăm aceeași ordine de chei în payload când îl construim.
  const msg = Buffer.from(JSON.stringify(payload), 'utf-8');
  const sigU8 = nacl.sign.detached(new Uint8Array(msg), secretKeyU8);
  return { payload, sig: Buffer.from(sigU8).toString('base64') };
}

function runCmd(cmd, args, cwd) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, shell: true });
    let out = '';
    let err = '';
    p.stdout.on('data', d => out += d.toString());
    p.stderr.on('data', d => err += d.toString());
    p.on('close', code => resolve({ code, out, err }));
  });
}

function findLatestInstallerExe(projectRoot) {
  const distDir = path.join(projectRoot, 'dist');
  if (!fs.existsSync(distDir)) return null;
  const files = fs.readdirSync(distDir).filter(f => f.toLowerCase().endsWith('.exe'));
  if (!files.length) return null;
  let best = null;
  let bestMtime = 0;
  for (const f of files) {
    const p = path.join(distDir, f);
    const st = fs.statSync(p);
    if (st.isFile() && st.mtimeMs > bestMtime) {
      bestMtime = st.mtimeMs;
      best = p;
    }
  }
  return best;
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 760,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  await win.loadFile(path.join(__dirname, 'license-ui.html'));
}

function buildPayloadLegacy({ customer, machineId, years, expires, features }) {
  const cust = (customer && String(customer).trim()) || 'CLIENT';
  const mid = (machineId && String(machineId).trim()) || '';
  if (!mid || mid.length < 6) throw new Error('Machine ID invalid.');

  let exp = (expires && String(expires).trim()) || '';
  if (!exp) {
    const y = Math.max(1, parseInt(years || '1', 10) || 1);
    const d = new Date();
    d.setFullYear(d.getFullYear() + y);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    exp = `${yyyy}-${mm}-${dd}`;
  }

  // IMPORTANT: ordine stabilă a cheilor
  const payload = {
    customer: cust,
    machineId: mid,
    expires: exp,
    graceDays: 0
  };

  return payload;
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

function randomLicenseId(durationMonths) {
  const stamp = todayISO().replaceAll('-', '');
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BLS-${durationMonths}M-${stamp}-${rnd}`;
}

function normalizeDurationMonths(value) {
  const n = parseInt(value || '12', 10);
  return [1, 6, 12].includes(n) ? n : 12;
}

function planForDuration(months) {
  if (months === 1) return 'PRO_1M';
  if (months === 6) return 'PRO_6M';
  return 'PRO_12M';
}

function buildPayload({ customer, machineId, durationMonths, expires, features }) {
  const cust = (customer && String(customer).trim()) || 'CLIENT';
  const mid = (machineId && String(machineId).trim()) || '';
  if (!mid || mid.length < 6) throw new Error('Machine ID invalid.');

  const months = normalizeDurationMonths(durationMonths);
  const exp = (expires && String(expires).trim()) || addMonthsISO(months);
  const cleanFeatures = Array.isArray(features) && features.length ? features : ['ALL'];

  return {
    customer: cust,
    licenseId: randomLicenseId(months),
    plan: planForDuration(months),
    machineId: mid,
    issuedAt: todayISO(),
    expires: exp,
    durationMonths: months,
    graceDays: 0,
    features: cleanFeatures.includes('ALL') ? ['ALL'] : cleanFeatures,
    maxLabels: 999999
  };
}

ipcMain.handle('license:generate', async (_evt, data) => {
  try {
    const { secretKey } = loadKeys();
    const payload = buildPayload(data || {});
    const licenseObj = makeLicenseObject(payload, secretKey);

    const safeCustomer = payload.customer.replace(/[^\w\-]+/g, '_');
    const defaultName = `license_${safeCustomer}_${payload.machineId.slice(0,8)}_${payload.expires}.json`;

    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win, {
      title: 'Salvează licența (license.json)',
      defaultPath: path.join(app.getPath('downloads'), defaultName),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (result.canceled || !result.filePath) return { ok: false, error: 'Anulat.' };

    fs.writeFileSync(result.filePath, JSON.stringify(licenseObj, null, 2), 'utf-8');
    return { ok: true, path: result.filePath, license: licenseObj };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});

ipcMain.handle('license:generate-and-pack', async (_evt, data) => {
  try {
    const { doBuild = true, doPack = true } = data || {};
    const { secretKey } = loadKeys();
    const payload = buildPayload(data || {});
    const licenseObj = makeLicenseObject(payload, secretKey);

    const safeCustomer = payload.customer.replace(/[^\w\-]+/g, '_');
    const deliveryDir = path.join(__dirname, `Delivery_${safeCustomer}_${new Date().toISOString().slice(0,10)}`);
    if (!fs.existsSync(deliveryDir)) fs.mkdirSync(deliveryDir, { recursive: true });

    const licensePath = path.join(deliveryDir, 'license.json');
    fs.writeFileSync(licensePath, JSON.stringify(licenseObj, null, 2), 'utf-8');

    const projectRoot = path.join(__dirname, '..');

    if (doBuild) {
      const r = await runCmd('npm', ['run', 'dist'], projectRoot);
      if (r.code !== 0) {
        return { ok: false, error: 'Build eșuat (npm run dist).', details: (r.err || r.out || '').slice(-2000) };
      }
    }

    if (doPack) {
      const installerPath = findLatestInstallerExe(projectRoot);
      if (!installerPath) return { ok: false, error: 'Nu găsesc installer .exe în dist/. Rulează întâi build.' };
      fs.copyFileSync(installerPath, path.join(deliveryDir, path.basename(installerPath)));

      const readme = [
        'Barcode Label Studio — Pachet Client',
        '',
        '1) Rulează installerul (.exe) și instalează aplicația.',
        '2) Activează licența:',
        '   - fie pui license.json lângă aplicație (auto-load),',
        '   - fie „Reînnoiește licența” și alegi license.json.',
        '',
        `Customer: ${payload.customer}`,
        `Machine ID: ${payload.machineId}`,
        `Expiră: ${payload.expires}`
      ].join('\n');
      fs.writeFileSync(path.join(deliveryDir, 'README_CLIENT.txt'), readme, 'utf-8');
    }

    return { ok: true, licensePath, deliveryDir: doPack ? deliveryDir : null };
  } catch (e) {
    return { ok: false, error: 'Eroare internă', details: String(e && e.stack ? e.stack : e) };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
