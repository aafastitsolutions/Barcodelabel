const fs = require('fs');
const path = require('path');
const nacl = require('tweetnacl');

function toB64(u8){ return Buffer.from(u8).toString('base64'); }

const kp = nacl.sign.keyPair();

const keys = {
  publicKeyB64: toB64(kp.publicKey),
  secretKeyB64: toB64(kp.secretKey),
};

const toolsDir = __dirname;
const keysPath = path.join(toolsDir, 'keys.json');
fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2), 'utf8');
console.log('OK: tools/keys.json generat');

const licenseJsPath = path.join(__dirname, '..', 'src', 'license.js');
let lic = fs.readFileSync(licenseJsPath, 'utf8');

// Replace placeholder
lic = lic.replace(/const LICENSE_PUBLIC_KEY_B64\s*=\s*["'][^"']*["']\s*;/,
                  `const LICENSE_PUBLIC_KEY_B64 = "${keys.publicKeyB64}";`);

fs.writeFileSync(licenseJsPath, lic, 'utf8');
console.log('OK: src/license.js actualizat cu public key');
