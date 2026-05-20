# Barcode Label Studio — Electron (All 5 upgrades)

Includes:
1) DEMO vs FULL gating (DEMO: max 20 labels, ZPL export/send blocked, watermark)
2) Offline license import (signed JSON) + machine binding
3) Send ZPL directly to Zebra over LAN (TCP 9100)
4) Live EAN-8 / EAN-13 validation + digits-only normalization
5) Refactor: logic moved into src/ + styles/

## Install
npm install
(After install, libs/ is auto-populated from node_modules via tools/copy-libs.js)

## Run
npm start

## Build installer
npm run dist

## Licensing (admin)
- Generate keys (first run): npm run make-keys
- Generate license.json: edit tools/make-license.js payload, run again: npm run make-license
- Paste public key from tools/keys.json into src/license.js (LICENSE_PUBLIC_KEY_B64)
- In the app, import tools/license.json via the License file picker.


NOTE: Renderer scripts are classic (no ES modules) for maximum Electron compatibility.


ANNUAL SUBSCRIPTION:
- license payload supports: issuedAt, expires (YYYY-MM-DD), graceDays
- When expired: app enters READ-ONLY (preview/import OK; ZPL export/send blocked)



LICENSE GENERATOR (UI):
- Folder: tools/LicenseGenerator
- Run: npm run license-ui
- Uses tools/keys.json from main project.
- Generates annual licenses (expires = issuedAt + years) with optional graceDays.

RENEWAL:
- In main app, use banner button 'Reînnoiește licența' (opens license import).
- Import overwrites previous license in storage (safe renewal).



PACK CLIENT (delivery folder):
1) Build installer: npm run dist
2) Create delivery pack:
   - npm run pack-client -- --customer "SC Client SRL" --license "C:\path\license.json"
   - or use config: npm run pack-client -- --config scripts\client-pack.config.json
Output folder:
   Delivery_<Customer>_<YYYY-MM-DD>\
