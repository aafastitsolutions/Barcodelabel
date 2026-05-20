const fs = require("fs");
const path = require("path");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copy(src, dst) {
  if (!fs.existsSync(src)) {
    console.error("Missing:", src);
    process.exitCode = 1;
    return;
  }
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  console.log("Copied", src, "->", dst);
}

const root = process.cwd();
const libsDir = path.join(root, "libs");
ensureDir(libsDir);

copy(path.join(root, "node_modules", "bwip-js", "dist", "bwip-js-min.js"), path.join(libsDir, "bwip-js-min.js"));
copy(path.join(root, "node_modules", "xlsx", "dist", "xlsx.full.min.js"), path.join(libsDir, "xlsx.full.min.js"));
copy(path.join(root, "node_modules", "tweetnacl", "nacl-fast.min.js"), path.join(libsDir, "nacl-fast.min.js"));
