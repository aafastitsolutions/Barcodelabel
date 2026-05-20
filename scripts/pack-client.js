// scripts/pack-client.js
// Creates a delivery folder with installer + optional license.json + README.
// Usage:
//   npm run dist
//   npm run pack-client -- --customer "SC Exemplu SRL" --license "C:\path\license.json"
//   npm run pack-client -- --config scripts\client-pack.config.json

const fs = require("fs");
const path = require("path");
const SUPPORT_EMAIL = "aafastitsolutions@gmail.com";

function argMap(argv){
  const m = {};
  for (let i=2;i<argv.length;i++){
    const a = argv[i];
    if (a.startsWith("--")){
      const k = a.slice(2);
      const v = (i+1<argv.length && !argv[i+1].startsWith("--")) ? argv[++i] : true;
      m[k]=v;
    }
  }
  return m;
}

function safeName(s){
  return String(s||"Client").replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"_").slice(0,60) || "Client";
}

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function ensureDir(p){ fs.mkdirSync(p, { recursive:true }); }

function readPackageVersion(){
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
    return pkg.version || "";
  } catch {
    return "";
  }
}

function findInstaller(distDir){
  if (!fs.existsSync(distDir)) return null;
  const items = fs.readdirSync(distDir)
    .filter(f => f.toLowerCase().endsWith(".exe"))
    .map(f => {
      const fullPath = path.join(distDir, f);
      return { name: f, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const prefer = items.find(x => /setup|installer|nsis/i.test(x.name)) || items[0];
  return prefer ? prefer.fullPath : null;
}

function writeReadme(dstPath, ctx){
  const txt = `Barcode Label Studio — Activare & Utilizare

Client: ${ctx.customer}
Versiune aplicație: ${ctx.version || "—"}
Data pachet: ${ctx.date}

1) Instalare
- Rulează installerul din folderul Installer.
- Finalizează instalarea.

2) Obținere Machine ID
- Deschide aplicația.
- În partea de sus găsești cardul "Machine ID".
- Apasă "Copiază Machine ID" și trimite-mi codul (WhatsApp / email).

3) Activare licență
- Dacă ai primit deja licența: în aplicație mergi la secțiunea Licență și importă fișierul license.json din folderul License.
- Dacă NU ai licența: trimite Machine ID și vei primi un license.json.

4) Reînnoire anuală
- Cu ~14 zile înainte de expirare apare un banner în aplicație.
- La reînnoire primești un license.json nou. Importul îl înlocuiește pe cel vechi.

Mod READ-ONLY (fără licență / expirat)
- Preview + listă + import Excel funcționează.
- Export ZPL / Send ZPL sunt blocate până la reînnoire.

Suport
- Contact: _______________________
`;
  fs.writeFileSync(dstPath, txt, "utf8");
}

function writeReadmeModern(dstPath, ctx){
  const txt = `Barcode Label Studio - Activare & Utilizare

Client: ${ctx.customer}
Versiune aplicatie: ${ctx.version || "-"}
Data pachet: ${ctx.date}

1) Instalare
- Ruleaza installerul din folderul Installer.
- Finalizeaza instalarea.

2) Obtinere Machine ID
- Deschide aplicatia.
- In partea de sus gasesti campul "Machine ID".
- Apasa "Copiaza" si trimite codul pentru emiterea licentei.

3) Activare licenta
- Daca ai primit cheia Lemon Squeezy dupa plata: in aplicatie mergi la Zebra / licenta -> Activare online.
- Daca ai primit license.json: in aplicatie mergi la Zebra / licenta si importa license.json din folderul License.
- Daca nu ai niciuna: trimite Machine ID la suport si vei primi instructiunile de activare.

4) Valabilitate
- Licentele pot fi emise pentru 1 luna, 6 luni sau 12 luni.
- La reinnoire primesti un license.json nou. Importul il inlocuieste pe cel vechi.

Mod demo
- Fara licenta activa aplicatia poate genera/printa maxim 5 etichete.
- Export ZPL si trimitere ZPL sunt blocate pana la activare.

Update aplicatie
- Aplicatia verifica automat versiunile noi la pornire.
- Cand apare un update, il descarca si cere instalare sau il instaleaza la urmatoarea pornire.
- Licenta ramane pe acelasi calculator dupa update.

Suport
- Contact licenta si suport: ${SUPPORT_EMAIL}
`;
  fs.writeFileSync(dstPath, txt, "utf8");
}

function main(){
  const args = argMap(process.argv);

  let cfg = {};
  if (args.config){
    const cfgPath = path.resolve(args.config);
    cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  }

  const customer = args.customer || cfg.customer || "Client";
  const version = args.version || cfg.version || readPackageVersion();
  const licensePath = args.license || cfg.license || "";
  const distDir = path.resolve(cfg.distDir || args.distDir || "dist");

  const date = todayISO();
  const root = path.resolve(`Delivery_${safeName(customer)}_${date}`);
  const installerDir = path.join(root, "Installer");
  const licenseDir = path.join(root, "License");

  if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
  ensureDir(installerDir);
  ensureDir(licenseDir);

  const installer = findInstaller(distDir);
  if (!installer){
    console.error(`Nu găsesc installer .exe în: ${distDir}`);
    console.error(`Rulează întâi: npm run dist`);
    process.exit(1);
  }

  const installerName = path.basename(installer);
  fs.copyFileSync(installer, path.join(installerDir, installerName));

  if (licensePath){
    const lp = path.resolve(licensePath);
    if (!fs.existsSync(lp)){
      console.error(`Fișier licență nu există: ${lp}`);
      process.exit(1);
    }
    fs.copyFileSync(lp, path.join(licenseDir, "license.json"));
  }

  writeReadmeModern(path.join(root, "README_Activare.txt"), { customer, version, date });

  console.log("OK! Pachet creat:");
  console.log(root);
  console.log("- Installer:", installerName);
  console.log("- License:", licensePath ? "inclusă" : "neinclusă (lipsește --license)");
}

main();
