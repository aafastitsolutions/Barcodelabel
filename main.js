const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { machineIdSync } = require('node-machine-id');
const { autoUpdater } = require("electron-updater");


// ===== Machine ID IPC =====
ipcMain.handle('lic:get-machine-id', () => getMachineId());
const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");
const net = require("net");
const { execFile } = require("child_process");

let mainWindow = null;
let updateStatus = {
  state: "idle",
  message: "Update: in asteptare.",
  version: app.getVersion(),
};

function sendUpdateStatus(patch) {
  updateStatus = { ...updateStatus, ...patch, version: app.getVersion() };
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("update:status", updateStatus);
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    sendUpdateStatus({ state: "checking", message: "Verific update..." });
  });
  autoUpdater.on("update-available", (info) => {
    sendUpdateStatus({ state: "available", message: `Update disponibil: ${info.version}. Se descarca...`, availableVersion: info.version });
  });
  autoUpdater.on("update-not-available", () => {
    sendUpdateStatus({ state: "none", message: `Ai ultima versiune (${app.getVersion()}).` });
  });
  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
    sendUpdateStatus({ state: "downloading", message: `Descarc update: ${percent}%`, percent });
  });
  autoUpdater.on("update-downloaded", (info) => {
    sendUpdateStatus({ state: "downloaded", message: `Update ${info.version} descarcat. Se poate instala acum sau la inchiderea aplicatiei.`, availableVersion: info.version });
    const win = BrowserWindow.getAllWindows()[0] || mainWindow;
    const prompt = {
      type: "info",
      buttons: ["Instaleaza acum", "La urmatoarea pornire"],
      defaultId: 0,
      cancelId: 1,
      title: "Update disponibil",
      message: `Barcode Label Studio ${info.version} este pregatit.`,
      detail: "Poti instala acum, iar aplicatia se va reporni automat. Daca alegi mai tarziu, update-ul se instaleaza cand inchizi aplicatia si va fi activ la urmatoarea pornire."
    };
    const showPrompt = win ? dialog.showMessageBox(win, prompt) : dialog.showMessageBox(prompt);
    showPrompt.then(({ response }) => {
      if (response === 0) {
        sendUpdateStatus({ state: "installing", message: "Instalez update si repornesc aplicatia..." });
        autoUpdater.quitAndInstall(false, true);
      } else {
        sendUpdateStatus({ state: "queued", message: `Update ${info.version} se instaleaza la inchiderea aplicatiei.` });
      }
    }).catch(() => {});
  });
  autoUpdater.on("error", (err) => {
    sendUpdateStatus({ state: "error", message: `Update error: ${err && err.message ? err.message : String(err)}` });
  });
}

async function checkForUpdates(manual = false) {
  if (!app.isPackaged) {
    const msg = "Update automat se testeaza din aplicatia instalata, nu din npm start.";
    sendUpdateStatus({ state: "dev", message: msg });
    return { ok: false, message: msg };
  }

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    const message = e && e.message ? e.message : String(e);
    sendUpdateStatus({ state: "error", message: `Update error: ${message}` });
    return { ok: false, message };
  }
}

function getMachineId() {
  // Single source of truth for Machine ID (same as shown in UI & used in licensing)
  return machineIdSync({ original: true });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function getWindowsDefaultPrinter() {
  if (process.platform !== "win32") return "";
  return await new Promise((resolve) => {
    execFile("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-Command",
      "(Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1 -ExpandProperty Name)"
    ], { windowsHide: true }, (err, stdout) => {
      if (err) return resolve("");
      resolve(String(stdout || "").trim());
    });
  });
}

async function rawPrintWindows(printerName, payload) {
  const printer = String(printerName || "").trim() || await getWindowsDefaultPrinter();
  if (!printer) return { ok: false, message: "Nu am gasit imprimanta implicita." };
  if (!payload) return { ok: false, message: "ZPL gol." };

  const jobId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const dataPath = path.join(os.tmpdir(), `barcode-label-studio-${jobId}.zpl`);
  const scriptPath = path.join(os.tmpdir(), `barcode-label-studio-rawprint-${jobId}.ps1`);

  const script = `
param([string]$PrinterName, [string]$FilePath)
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static bool SendFile(string printerName, string fileName, out int written, out int expected) {
    written = 0;
    byte[] bytes = System.IO.File.ReadAllBytes(fileName);
    expected = bytes.Length;
    IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
    Marshal.Copy(bytes, 0, pBytes, bytes.Length);

    IntPtr hPrinter;
    DOCINFOA di = new DOCINFOA();
    di.pDocName = "Barcode Label Studio ZPL";
    di.pDataType = "RAW";

    bool ok = false;
    try {
      if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
        try {
          if (StartDocPrinter(hPrinter, 1, di)) {
            try {
              if (StartPagePrinter(hPrinter)) {
                try {
                  ok = WritePrinter(hPrinter, pBytes, bytes.Length, out written);
                } finally {
                  EndPagePrinter(hPrinter);
                }
              }
            } finally {
              EndDocPrinter(hPrinter);
            }
          }
        } finally {
          ClosePrinter(hPrinter);
        }
      }
    } finally {
      Marshal.FreeCoTaskMem(pBytes);
    }

    return ok && written == expected;
  }
}
"@
$written = 0
$expected = 0
$ok = [RawPrinterHelper]::SendFile($PrinterName, $FilePath, [ref]$written, [ref]$expected)
if (-not $ok) {
  throw "RAW print failed. Bytes: $written / $expected"
}
`;

  try {
    fs.writeFileSync(dataPath, Buffer.from(String(payload), "utf8"));
    fs.writeFileSync(scriptPath, script, "utf8");

    return await new Promise((resolve) => {
      execFile("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", scriptPath,
        printer,
        dataPath,
      ], { windowsHide: true, timeout: 30000 }, (err, stdout, stderr) => {
        try { fs.unlinkSync(dataPath); } catch {}
        try { fs.unlinkSync(scriptPath); } catch {}
        if (err) {
          resolve({ ok: false, message: String(stderr || err.message || err).trim() });
          return;
        }
        resolve({ ok: true, message: `ZPL RAW trimis la ${printer}.` });
      });
    });
  } catch (e) {
    try { fs.unlinkSync(dataPath); } catch {}
    try { fs.unlinkSync(scriptPath); } catch {}
    return { ok: false, message: e?.message || String(e) };
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "src", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "index.html"));
  mainWindow = win;
  return win;
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  setTimeout(() => checkForUpdates(false), 3500);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => app.quit());

ipcMain.handle("app:getMachineId", async () => getMachineId());
ipcMain.handle("app:getVersion", async () => app.getVersion());
ipcMain.handle("app:openExternal", async (_event, url) => {
  if (!/^mailto:/i.test(String(url || ""))) {
    return { ok: false, message: "URL extern blocat." };
  }
  await shell.openExternal(url);
  return { ok: true };
});
ipcMain.handle("update:getStatus", async () => updateStatus);
ipcMain.handle("update:check", async () => checkForUpdates(true));
ipcMain.handle("update:install", async () => {
  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
});

ipcMain.handle("print:listPrinters", async (event) => {
  try {
    const printers = await event.sender.getPrintersAsync();
    const defaultName = await getWindowsDefaultPrinter();
    return { ok: true, defaultName, printers: printers.map(p => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault || p.name === defaultName,
      status: p.status,
    })) };
  } catch (e) {
    return { ok: false, message: e?.message || String(e), printers: [], defaultName: "" };
  }
});

ipcMain.handle("print:rawZpl", async (_event, { printerName, zpl } = {}) => {
  if (process.platform !== "win32") {
    return { ok: false, message: "RAW ZPL prin spooler este implementat pentru Windows." };
  }
  return await rawPrintWindows(printerName, zpl);
});

// Auto-load license.json placed next to the app (portable delivery)
ipcMain.handle("app:readAutoLicense", async () => {
  try {
    const candidates = [];
    // packaged exe location
    if (app && app.getPath) {
      const exeDir = path.dirname(app.getPath("exe"));
      candidates.push(path.join(exeDir, "license.json"));
    }
    // dev mode / current working dir
    candidates.push(path.join(process.cwd(), "license.json"));

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, "utf8");
      }
    }
    return null;
  } catch (e) {
    return null;
  }
});

ipcMain.handle("zpl:sendTcp9100", async (event, { host, port = 9100, zpl }) => {
  return await new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (ok, message) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve({ ok, message });
    };

    socket.setTimeout(6000);

    socket.connect(port, host, () => {
      socket.write(zpl, "utf8", () => finish(true, "Trimis către imprimantă."));
    });

    socket.on("error", (err) => finish(false, "Eroare: " + (err?.message || String(err))));
    socket.on("timeout", () => finish(false, "Timeout (nu răspunde imprimanta)."));
  });
});
ipcMain.handle("print:currentPage", async (event, { mode, widthMicrons, heightMicrons } = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { ok: false, message: "Fereastra de print nu este disponibila." };

  const pageSize = mode === "a4"
    ? "A4"
    : {
        width: Math.max(1000, Number(widthMicrons) || 50000),
        height: Math.max(1000, Number(heightMicrons) || 32000),
      };

  return await new Promise((resolve) => {
    win.webContents.print({
      silent: false,
      printBackground: true,
      scaleFactor: 100,
      pageSize,
      header: "",
      footer: "",
      margins: { marginType: "none" },
    }, (success, failureReason) => {
      resolve(success
        ? { ok: true, message: "Print trimis." }
        : { ok: false, message: failureReason || "Print anulat sau esuat." });
    });
  });
});

ipcMain.handle("print:labels", async (event, { labels = [], mode, widthMm, heightMm } = {}) => {
  if (!Array.isArray(labels) || labels.length === 0) {
    return { ok: false, message: "Nu exista etichete de printat." };
  }

  const parent = BrowserWindow.fromWebContents(event.sender);
  const w = Math.max(1, Number(widthMm) || 50);
  const h = Math.max(1, Number(heightMm) || 32);
  const isA4 = mode === "a4";
  const pageSize = isA4 ? "A4" : { width: Math.round(w * 1000), height: Math.round(h * 1000) };
  const pageRule = isA4 ? "A4" : `${w}mm ${h}mm`;

  const labelHtml = labels.map((src) => (
    `<div class="label-page"><img src="${escapeHtml(src)}" alt=""></div>`
  )).join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Labels</title>
  <style>
    @page { size: ${pageRule}; margin: 0; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }
    * { box-sizing: border-box; }
    .sheet {
      margin: 0;
      padding: 0;
    }
    .label-page {
      width: ${w}mm;
      height: ${h}mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
      display: block;
      position: relative;
      break-after: page;
      page-break-after: always;
    }
    .label-page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    img {
      display: block;
      width: ${w}mm;
      height: ${h}mm;
      margin: 0;
      padding: 0;
      image-rendering: pixelated;
    }
    ${isA4 ? `
    @page { size: A4; margin: 0; }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      padding: 8mm;
      display: grid;
      grid-template-columns: repeat(auto-fill, ${w}mm);
      grid-auto-rows: ${h}mm;
      gap: 2mm;
      align-content: start;
      justify-content: start;
    }
    .label-page {
      break-after: auto;
      page-break-after: auto;
    }` : ""}
  </style>
</head>
<body><div class="sheet">${labelHtml}</div></body>
</html>`;

  const printWin = new BrowserWindow({
    show: false,
    parent,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  return await new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      try { printWin.close(); } catch {}
      resolve(result);
    };

    printWin.webContents.on("did-fail-load", (_event, _code, desc) => {
      finish({ ok: false, message: desc || "Documentul de print nu s-a incarcat." });
    });

    printWin.webContents.once("did-finish-load", () => {
      printWin.webContents.print({
        silent: false,
        printBackground: true,
        scaleFactor: 100,
        pageSize,
        header: "",
        footer: "",
        margins: { marginType: "none" },
      }, (success, failureReason) => {
        finish(success
          ? { ok: true, message: "Print trimis." }
          : { ok: false, message: failureReason || "Print anulat sau esuat." });
      });
    });

    printWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  });
});
