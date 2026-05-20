(function(){
  function showFatal(err){
    console.error(err);
    const msg = (err && err.stack) ? err.stack : ((err && err.message) ? err.message : String(err));
    const hint = document.getElementById("zplSendStatus") || document.getElementById("licenseStatus");
    if (hint) hint.textContent = "Eroare JS: " + msg.split("\n")[0];
    alert("Eroare aplicație:\n" + msg);
  }

  window.addEventListener("error", (e)=> showFatal(e.error || e.message || e));
  window.addEventListener("unhandledrejection", (e)=> showFatal(e.reason || e));

  document.addEventListener("DOMContentLoaded", () => {
    try {
      const el = UI.el;

      const state = { rows: [], license: { ok:false }, policy: License.demoPolicy() };
      const LICENSE_CONTACT_EMAIL = "aafastitsolutions@gmail.com";

      function licenseContactUrl(){
        const machineId = (document.getElementById("machineIdValue")?.textContent || "").trim();
        const version = (document.getElementById("appVersion")?.textContent || "").trim();
        const subject = "Licenta Barcode Label Studio";
        const body = [
          "Buna ziua,",
          "",
          "Am nevoie de licenta pentru Barcode Label Studio.",
          machineId && machineId !== "-" ? `Machine ID: ${machineId}` : "Machine ID: ",
          version ? `Versiune aplicatie: ${version}` : "",
          "",
          "Multumesc."
        ].filter(Boolean).join("\n");
        return `mailto:${LICENSE_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }

      function contactLicense(){
        const url = licenseContactUrl();
        if (window.AppBridge && window.AppBridge.openExternal) {
          window.AppBridge.openExternal(url);
        } else {
          window.location.href = url;
        }
      }

      function setText(id, txt){
        const n = document.getElementById(id);
        if (n) n.textContent = (txt === undefined || txt === null || txt === "") ? "—" : String(txt);
      }
      function showBanner(title, body, showRenew){
        const b = document.getElementById("licenseBanner");
        if (!b) return;
        const t = document.getElementById("bannerTitle");
        const bd = document.getElementById("bannerBody");
        const btn = document.getElementById("btnRenewLicense");
        if (t) t.textContent = title || "—";
        if (bd) bd.textContent = body || "—";
        if (btn) btn.style.display = showRenew ? "inline-flex" : "none";
        b.classList.remove("hidden");
      }
      function hideBanner(){
        const b = document.getElementById("licenseBanner");
        if (b) b.classList.add("hidden");
      }
      function updateLicenseUILegacy(){
        if (state.license && state.license.ok){
          const p = state.license.payload || {};
          const plan = p.plan || "PRO_ANNUAL";
          const exp = p.expires || "";
          setText("licPlan", plan);
          setText("licCustomer", p.customer || "");
          setText("licId", p.licenseId || "");
          setText("licExpires", exp);
          if (typeof state.license.daysLeft === "number"){
            setText("licDaysLeft", state.license.inGrace ? `GRAȚIE (întârziat ${Math.abs(state.license.daysLeft)} zile)` : state.license.daysLeft);
          } else {
            setText("licDaysLeft", "—");
          }
          setText("licStatus", state.license.isAdmin ? "ADMIN LOCAL" : (state.license.inGrace ? "EXPIRAT (GRATIE)" : "ACTIVA"));
        } else {
          setText("licPlan", "—"); setText("licCustomer", "—"); setText("licId", "—");
          setText("licExpires", "—"); setText("licDaysLeft", "—");
          const r = (state.license && state.license.reason) ? state.license.reason : "no_license";
          setText("licStatus", r === "expired" ? "EXPIRATĂ (READ-ONLY)" : "READ-ONLY");
        }

        if (state.license && state.license.isAdmin) {
          hideBanner();
        } else if (state.license && state.license.ok){
          const p = state.license.payload || {};
          const exp = p.expires || "";
          if (state.license.inGrace){
            showBanner("Licență expirată (grație)", "Poți folosi preview/import, dar export/send ZPL sunt blocate. Reînnoiește ca să activezi FULL.", true);
          } else if (typeof state.license.daysLeft === "number" && state.license.daysLeft <= 14){
            showBanner("Licența expiră curând", `Mai ai ${state.license.daysLeft} zile până la expirare (${exp}).`, true);
          } else {
            hideBanner();
          }
        } else {
          const r = (state.license && state.license.reason) ? state.license.reason : "no_license";
          if (r === "expired"){
            showBanner("Licență expirată", "Aplicația este în READ-ONLY (preview/import OK). Reînnoiește ca să activezi export/send ZPL.", true);
          } else {
            showBanner("Fără licență activă", "Aplicația este în READ-ONLY. Importă o licență anuală ca să activezi export/send ZPL.", true);
          }
        }
      }


      function updateLicenseUI(){
        const max = policyMaxLabels();
        if (state.license && state.license.ok){
          const p = state.license.payload || {};
          const plan = p.plan || "PRO";
          const exp = p.expires || "";
          setText("licPlan", plan);
          setText("licCustomer", p.customer || "");
          setText("licId", p.licenseId || "");
          setText("licExpires", exp);
          if (typeof state.license.daysLeft === "number"){
            setText("licDaysLeft", state.license.inGrace ? `GRATIE (${Math.abs(state.license.daysLeft)} zile)` : state.license.daysLeft);
          } else {
            setText("licDaysLeft", "-");
          }
          setText("licStatus", state.license.inGrace ? "EXPIRAT" : "ACTIVA");

          if (state.license.inGrace){
            showBanner("Licenta expirata", `Aplicatia a trecut in demo: maxim ${max} etichete. Contact licenta: ${LICENSE_CONTACT_EMAIL}.`, true);
          } else if (typeof state.license.daysLeft === "number" && state.license.daysLeft <= 14){
            showBanner("Licenta expira curand", `Mai ai ${state.license.daysLeft} zile pana la expirare (${exp}). Contact: ${LICENSE_CONTACT_EMAIL}.`, true);
          } else {
            hideBanner();
          }
        } else {
          const reason = (state.license && state.license.reason) ? state.license.reason : "no_license";
          setText("licPlan", "DEMO"); setText("licCustomer", "-"); setText("licId", "-");
          setText("licExpires", "-"); setText("licDaysLeft", "-");
          setText("licStatus", reason === "expired" ? "EXPIRAT" : "DEMO");
          showBanner("Mod demo", `Fara licenta activa poti genera si printa maxim ${max} etichete. Pentru licenta: ${LICENSE_CONTACT_EMAIL}.`, true);
        }
      }

      function mmToPx(mm, dpi){ return Math.round((mm/25.4)*dpi); }
      function mmToDots(mm, dpi){ return Math.round((mm/25.4)*dpi); }
      function clamp(v,min,max){ return max < min ? min : Math.max(min, Math.min(max, v)); }
      function parseFontPair(str){
        const parts = String(str).split(",").map(s=>parseInt(s.trim(),10)).filter(n=>Number.isFinite(n));
        return { top: parts[0] ?? 12, bottom: parts[1] ?? parts[0] ?? 12 };
      }
      function tpl(str,row){
        return String(str)
          .replaceAll("{sku}", row.sku ?? "")
          .replaceAll("{cod}", row.sku ?? "")
          .replaceAll("{continut_cod}", row.sku ?? "")
          .replaceAll("{descriere}", row.descriere ?? "")
          .replaceAll("{text_sus}", row.textSus ?? "")
          .replaceAll("{textSus}", row.textSus ?? "")
          .replaceAll("{text_jos}", row.textJos ?? row.descriere ?? "")
          .replaceAll("{textJos}", row.textJos ?? row.descriere ?? "");
      }
      function readQty(id){
        const n = parseInt((document.getElementById(id)?.value || "1"), 10);
        return Number.isFinite(n) ? clamp(n, 1, 999) : 1;
      }
      function repeatRows(rows){
        const manualQty = readQty("manualQty");
        const excelQty = readQty("excelQty");
        const out = [];
        rows.forEach((row) => {
          const qty = row.source === "excel" ? excelQty : manualQty;
          for (let i = 0; i < qty; i++) out.push(row);
        });
        return out;
      }
      function rowTopText(row){
        const own = String(row.textSus ?? "").trim();
        return own ? tpl(own, row).trim() : tpl(el("topTpl").value, row).trim();
      }
      function rowBottomText(row){
        const own = String(row.textJos ?? "").trim();
        return own ? tpl(own, row).trim() : tpl(el("bottomTpl").value, row).trim();
      }
      function getBcid(){
        const custom = (el("bcidCustom").value || "").trim();
        if (!custom) return el("bcid").value;
        if (/^\d+$/.test(custom)) return el("bcid").value;
        if (!/^[a-z0-9][a-z0-9\-_]*$/i.test(custom)) return el("bcid").value;
        return custom.toLowerCase();
      }
      function zebraCommandForBcid(bcid){
        const map = {
          code128: "^BC",
          ean13: "^BE",
          ean8: "^B8",
          qrcode: "^BQ",
          datamatrix: "^BX",
          gs1datamatrix: "Bitmap",
          sscc18: "Bitmap",
          pdf417: "^B7",
          code39: "^B3",
          upca: "^BU",
          itf14: "^B2"
        };
        return map[bcid] || "Custom";
      }

      function updateBcidStatus(){
        const bcid = getBcid();
        el("bcidStatus").textContent = `Cod: ${zebraCommandForBcid(bcid)} (${bcid})`;
        const sku = el("manualSku").value.trim();
        const v = UI.validateEan(bcid, sku);
        const pill = document.getElementById("eanLiveStatus");
        if (pill) pill.textContent = (bcid==="ean8" || bcid==="ean13") ? v.msg : "—";
        if (pill) pill.textContent = v.msg && v.msg !== "-" ? v.msg : "-";
      }

      function hasFullLicense(){
        return !!(state.license && state.license.ok && !state.license.inGrace);
      }

      function policyMaxLabels(){
        const n = Number(state.policy && state.policy.maxLabels);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
      }

      function fallbackManualRow(){
        return {
          sku: el("manualSku").value.trim(),
          descriere: el("manualDesc").value.trim(),
          source: "manual"
        };
      }

      function sourceRows(){
        return state.rows.length ? state.rows : [fallbackManualRow()];
      }

      function rowsForWork(previewLimit){
        const rows = repeatRows(sourceRows());
        const licensedRows = hasFullLicense() ? rows : rows.slice(0, policyMaxLabels());
        if (Number.isFinite(previewLimit) && previewLimit > 0) return licensedRows.slice(0, previewLimit);
        return licensedRows;
      }

      function demoLimitMessage(action, total, used){
        const max = policyMaxLabels();
        return `DEMO: fara licenta activa, ${action} doar primele ${used}/${total} etichete (limita ${max}).`;
      }

      function enforceListLimit(){
        if (hasFullLicense()) return false;
        const max = policyMaxLabels();
        if (state.rows.length <= max) return false;
        state.rows = state.rows.slice(0, max);
        return true;
      }

      function applyPreset(){
        const v = el("labelPreset").value;
        if (v === "50x32") { el("wmm").value = 50; el("hmm").value = 32; el("fontPx").value = "16,16"; el("textGapPx").value = 1; el("padPx").value = 6; el("codeScalePct").value = 85; }
        if (v === "50x25") { el("wmm").value = 50; el("hmm").value = 25; el("fontPx").value = "14,14"; el("textGapPx").value = 1; el("padPx").value = 5; el("codeScalePct").value = 80; }
        if (v === "110x260") { el("wmm").value = 110; el("hmm").value = 260; el("fontPx").value = "24,24"; el("textGapPx").value = 2; el("padPx").value = 14; el("codeScalePct").value = 100; }
      }

      function applyPolicyToUILegacy(){
        // Read-only by default; FULL only with valid license
        if (state.license.ok) {
          const plan = state.license.payload && state.license.payload.plan ? state.license.payload.plan : "PRO_ANNUAL";
          const exp = state.license.payload && state.license.payload.expires ? state.license.payload.expires : "";
          const daysLeft = (typeof state.license.daysLeft === "number") ? state.license.daysLeft : null;

          if (state.license.isAdmin) {
            el("licenseStatus").textContent = "Mod: ADMIN LOCAL - export si trimitere ZPL active";
          } else if (state.license.inGrace) {
            el("licenseStatus").textContent = `Licență EXPIRATĂ (grație). Reînnoiește!`;
          } else if (daysLeft !== null && daysLeft <= 14) {
            el("licenseStatus").textContent = `Licență activă (${plan}) — expiră în ${daysLeft} zile (${exp})`;
          } else if (exp) {
            el("licenseStatus").textContent = `Licență activă (${plan}) — valabilă până la ${exp}`;
          } else {
            el("licenseStatus").textContent = `Licență activă (${plan})`;
          }
        } else {
          // Read-only mode (no license / expired / invalid)
          const reason = state.license.reason || "no_license";
          const label = (reason === "expired") ? "READ-ONLY (expirat)" : "READ-ONLY";
          el("licenseStatus").textContent = `Mod: ${label}`;
        }

        const isFull = state.license.ok && !state.license.inGrace;
        el("btnExportZpl").disabled = !isFull;
        el("btnSendZpl").disabled = !isFull;
      }

      function applyPolicyToUI(){
        const full = hasFullLicense();
        const max = policyMaxLabels();
        const exportAllowed = !!(state.policy && state.policy.allowExportZpl);
        const sendAllowed = !!(state.policy && state.policy.allowSendZpl);
        const printAllowed = !state.policy || state.policy.allowPrint !== false;

        if (full) {
          const plan = state.license.payload && state.license.payload.plan ? state.license.payload.plan : "PRO";
          const exp = state.license.payload && state.license.payload.expires ? state.license.payload.expires : "";
          const daysLeft = (typeof state.license.daysLeft === "number") ? state.license.daysLeft : null;

          if (state.license.isAdmin) {
            el("licenseStatus").textContent = "Mod: ADMIN LOCAL - toate functiile active";
          } else if (daysLeft !== null && daysLeft <= 14) {
            el("licenseStatus").textContent = `Licenta activa (${plan}) - expira in ${daysLeft} zile (${exp})`;
          } else if (exp) {
            el("licenseStatus").textContent = `Licenta activa (${plan}) - valabila pana la ${exp}`;
          } else {
            el("licenseStatus").textContent = `Licenta activa (${plan})`;
          }
        } else {
          const reason = state.license && state.license.reason ? state.license.reason : "no_license";
          const label = state.license && state.license.inGrace ? "licenta expirata" : reason;
          el("licenseStatus").textContent = `Mod DEMO (${label}) - maxim ${max} etichete. Contact: ${LICENSE_CONTACT_EMAIL}`;
        }

        el("btnExportZpl").disabled = !exportAllowed;
        el("btnSendZpl").disabled = !sendAllowed;
        el("btnPrint").disabled = !printAllowed;
      }

      async function initLicense(){
        state.license = await License.loadLicenseFromStorage();
        state.policy = License.policyFromLicense ? License.policyFromLicense(state.license) : (hasFullLicense() ? { maxLabels: 999999, allowExportZpl: true, allowSendZpl: true, allowPrint: true, watermark: "" } : License.demoPolicy());
        const trimmed = enforceListLimit();
        applyPolicyToUI();
        updateLicenseUI();
        if (trimmed) refreshTable();
        doPreview();
      }

      function renderLabelToCanvas(row){
        const dpi = parseInt(el("dpi").value, 10);
        const wmm = parseFloat(el("wmm").value);
        const hmm = parseFloat(el("hmm").value);
        const padPx = parseInt(el("padPx").value, 10);
        const gapPx = parseInt(el("textGapPx").value, 10);
        const forceBarcodeHPx = parseInt(el("forceBarcodeHPx").value, 10) || 0;
        const codeScale = clamp((parseFloat(el("codeScalePct").value) || 100) / 100, 0.2, 1.5);
        const fonts = parseFontPair(el("fontPx").value);

        const bcOffX = mmToPx(parseFloat(el("bcOffXmm").value) || 0, dpi);
        const bcOffY = mmToPx(parseFloat(el("bcOffYmm").value) || 0, dpi);
        const topOffX = mmToPx(parseFloat(el("topOffXmm").value) || 0, dpi);
        const topOffY = mmToPx(parseFloat(el("topOffYmm").value) || 0, dpi);
        const botOffX = mmToPx(parseFloat(el("botOffXmm").value) || 0, dpi);
        const botOffY = mmToPx(parseFloat(el("botOffYmm").value) || 0, dpi);

        const labelW = mmToPx(wmm, dpi);
        const labelH = mmToPx(hmm, dpi);

        const topText = rowTopText(row);
        const bottomText = rowBottomText(row);
        const rawSku = String(row.sku ?? "").trim();

        const chosen = getBcid();
        const vEan = UI.validateEan(chosen, rawSku);
        const value = vEan.render || vEan.digits || rawSku;

        const canvas = document.createElement("canvas");
        canvas.width = labelW; canvas.height = labelH;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0,0,labelW,labelH);

        if (!vEan.ok){
          ctx.fillStyle = "#000"; ctx.font = "12px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(vEan.msg, labelW/2, labelH/2);
          return canvas;
        }

        const pad = padPx, gap = Math.max(0, gapPx);
        const topH = topText ? fonts.top : 0;
        const botH = bottomText ? fonts.bottom : 0;

        const reserveTop = topText ? (topH + gap) : 0;
        const reserveBottom = bottomText ? (botH + gap) : 0;
        const barTop = pad + reserveTop;
        const barBottom = labelH - pad - reserveBottom;

        let maxBarcodeH = Math.max(10, barBottom - barTop);
        if (forceBarcodeHPx > 0) maxBarcodeH = Math.min(maxBarcodeH, forceBarcodeHPx);

        const bcCanvas = document.createElement("canvas");
        const scale = Math.max(2, Math.round(dpi/150));
        const BW = (window.BWIPJS || window.bwipjs);
        if (!BW || !BW.toCanvas){
          ctx.fillStyle = "#000"; ctx.font = "12px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText("bwip-js nu e încărcat", labelW/2, labelH/2);
          return canvas;
        }

        try {
          const isEan = (chosen === "ean8" || chosen === "ean13");
          const opts = {
            bcid: chosen,
            text: value,
            includetext: false,
            backgroundcolor: "FFFFFF",
            padding: 0,
            // EAN needs a bit more X-resolution so bars don't disappear when scaled
            scale: isEan ? Math.max(4, scale) : scale,
            scaleX: isEan ? 3 : undefined,
            scaleY: isEan ? 2 : undefined,
          };
          // Remove undefined so bwip doesn't complain
          Object.keys(opts).forEach(k => (opts[k] === undefined) && delete opts[k]);

          BW.toCanvas(bcCanvas, opts);

          // Sanity check: if render produced almost nothing, show a clear error
          if (bcCanvas.width < 20 || bcCanvas.height < 20) {
            throw new Error("Barcode EAN nu s-a randat (canvas prea mic).");
          }
        } catch (e){
          ctx.fillStyle = "#000"; ctx.font="12px Arial"; ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText("Eroare barcode", labelW/2, labelH/2);
          return canvas;
        }

        const bw = bcCanvas.width, bh = bcCanvas.height;
        const fit = Math.min((labelW - pad*2)/bw, maxBarcodeH/bh);
        const dw = Math.max(1, Math.floor(bw * fit * codeScale));
        const dh = Math.max(1, Math.floor(bh * fit * codeScale));

        let dx = Math.round((labelW-dw)/2) + bcOffX;
        let dy = Math.round(barTop + (maxBarcodeH - dh)/2) + bcOffY;
        dx = clamp(dx, 1, labelW-dw-1);
        dy = clamp(dy, 1, labelH-dh-1);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bcCanvas, dx, dy, dw, dh);

        if (topText){
          const topY = clamp(dy - gap - topH + topOffY, pad, labelH - topH - pad);
          ctx.font = `${fonts.top}px Arial`; ctx.fillStyle="#000"; ctx.textAlign="center"; ctx.textBaseline="top";
          ctx.fillText(topText, (labelW/2) + topOffX, topY);
        }

        if (bottomText){
          const bottomY = clamp(dy + dh + gap + botOffY, pad, labelH - botH - pad);
          ctx.font = `${fonts.bottom}px Arial`; ctx.fillStyle="#000"; ctx.textAlign="center"; ctx.textBaseline="top";
          ctx.fillText(bottomText, (labelW/2) + botOffX, bottomY);
        }

        if (!state.license.ok && state.policy.watermark){
          ctx.save();
          ctx.globalAlpha = 0.18;
          ctx.fillStyle="#000";
          ctx.font = `${Math.max(18, Math.round(labelH/6))}px Arial`;
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.translate(labelW/2, labelH/2);
          ctx.rotate(-Math.PI/8);
          ctx.fillText(state.policy.watermark, 0, 0);
          ctx.restore();
        }

        return canvas;
      }

      function makePrintCanvas(sourceCanvas, offsetXmm, offsetYmm, scale, dpi){
        const canvas = document.createElement("canvas");
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        const dx = mmToPx(offsetXmm || 0, dpi);
        const dy = mmToPx(offsetYmm || 0, dpi);
        const dw = Math.round(sourceCanvas.width * scale);
        const dh = Math.round(sourceCanvas.height * scale);
        ctx.drawImage(sourceCanvas, dx, dy, dw, dh);
        return canvas;
      }

      function canvasToGfa(canvas){
        const w = canvas.width;
        const h = canvas.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const pixels = ctx.getImageData(0, 0, w, h).data;
        const bytesPerRow = Math.ceil(w / 8);
        const totalBytes = bytesPerRow * h;
        let hex = "";

        for (let y = 0; y < h; y++) {
          for (let bx = 0; bx < bytesPerRow; bx++) {
            let value = 0;
            for (let bit = 0; bit < 8; bit++) {
              const x = bx * 8 + bit;
              if (x >= w) continue;
              const i = (y * w + x) * 4;
              const alpha = pixels[i + 3];
              const lum = (pixels[i] * 0.299) + (pixels[i + 1] * 0.587) + (pixels[i + 2] * 0.114);
              if (alpha > 32 && lum < 210) value |= (0x80 >> bit);
            }
            hex += value.toString(16).padStart(2, "0").toUpperCase();
          }
        }

        return `^GFA,${totalBytes},${totalBytes},${bytesPerRow},${hex}`;
      }

      function makeBitmapZplForRow(row){
        const dpi = parseInt(el("dpi").value, 10);
        const printOffsetXmm = Number.isFinite(parseFloat(el("printOffXmm").value)) ? parseFloat(el("printOffXmm").value) : 0;
        const printOffsetYmm = Number.isFinite(parseFloat(el("printOffYmm").value)) ? parseFloat(el("printOffYmm").value) : 0;
        const printScale = clamp((Number.isFinite(parseFloat(el("printScalePct").value)) ? parseFloat(el("printScalePct").value) : 100) / 100, 0.25, 2);
        const baseCanvas = renderLabelToCanvas(row);
        const canvas = makePrintCanvas(baseCanvas, printOffsetXmm, printOffsetYmm, printScale, dpi);

        return [
          "^XA",
          "^CI28",
          "^MMT",
          `^PW${canvas.width}`,
          `^LL${canvas.height}`,
          "^LH0,0",
          `^FO0,0${canvasToGfa(canvas)}^FS`,
          "^PQ1,0,1,Y",
          "^XZ"
        ].join("\n") + "\n";
      }

      function makeBitmapZplBulk(rows){ return rows.map(makeBitmapZplForRow).join("\r\n"); }

      async function loadPrinterList(){
        const select = document.getElementById("printerName");
        const status = document.getElementById("printStatus");
        if (!select || !window.AppBridge || !window.AppBridge.listPrinters) return;

        const res = await window.AppBridge.listPrinters();
        if (!res || !res.ok) {
          if (status) status.textContent = "Nu am putut citi lista de imprimante.";
          return;
        }

        const printers = Array.isArray(res.printers) ? res.printers : [];
        select.innerHTML = "";
        printers.forEach((p) => {
          const option = document.createElement("option");
          option.value = p.name;
          option.textContent = p.isDefault ? `${p.name} (implicit)` : p.name;
          if (p.isDefault || p.name === res.defaultName) option.selected = true;
          select.appendChild(option);
        });

        if (!printers.length) {
          const option = document.createElement("option");
          option.value = "";
          option.textContent = "Imprimanta implicita";
          select.appendChild(option);
        }

        if (status) {
          const active = select.options[select.selectedIndex];
          status.textContent = `Print Bitmap ZPL: ${active ? active.textContent : "imprimanta implicita"}.`;
        }
      }

      function refreshTable(){
        const tb = el("tbl").querySelector("tbody");
        tb.innerHTML = "";
        state.rows.forEach((r,i)=>{
          const tr = document.createElement("tr");
          const topText = String(r.textSus ?? "").trim();
          const bottomText = String(r.textJos ?? r.descriere ?? "").trim();
          tr.innerHTML = `<td>${i+1}</td><td>${UI.escapeHtml(r.sku ?? "")}</td><td>${UI.escapeHtml(topText)}</td><td>${UI.escapeHtml(bottomText)}</td>
            <td><button data-i="${i}" class="ghost" type="button">Șterge</button></td>`;
          tb.appendChild(tr);
        });
        tb.querySelectorAll("button[data-i]").forEach(btn=>{
          btn.addEventListener("click", ()=>{
            const i = parseInt(btn.getAttribute("data-i"),10);
            state.rows.splice(i,1);
            refreshTable();
            doPreview();
          });
        });
      }

      function doPreview(){
        const preview = el("preview");
        preview.innerHTML = "";
        const rows = rowsForWork(1);
        const dpi = parseInt(el("dpi").value,10);
        const wmm = parseFloat(el("wmm").value);
        const labelWpx = mmToPx(wmm, dpi);

        rows.forEach(r=>{
          const card = document.createElement("div");
          card.className = "card";
          const canvas = renderLabelToCanvas(r);
          const targetW = Math.max(340, Math.round(labelWpx / 2.0));
          canvas.style.width = `${targetW}px`;
          canvas.style.height = "auto";
          canvas.style.imageRendering = "pixelated";
          card.appendChild(canvas);
          preview.appendChild(card);
        });
      }

      function setPrintPageStyle(mode, wmm, hmm){
        let style = document.getElementById("dynamicPrintStyle");
        if (!style) {
          style = document.createElement("style");
          style.id = "dynamicPrintStyle";
          (document.head || document.documentElement).appendChild(style);
        }

        const pageRule = mode === "a4"
          ? "@page { size: A4; margin: 0; }"
          : `@page { size: ${wmm}mm ${hmm}mm; margin: 0; }`;

        style.textContent = `
          ${pageRule}
          @media print {
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            #printRoot {
              margin: 0 !important;
              padding: 0 !important;
            }
            .single-label-page {
              width: ${wmm}mm !important;
              height: ${hmm}mm !important;
            }
          }
        `;
      }

      function doPrint(){
        const root = el("printRoot");
        if (state.policy && state.policy.allowPrint === false) {
          alert("Licenta nu permite print.");
          return;
        }
        const totalRows = repeatRows(sourceRows()).length;
        const rows = rowsForWork();
        if (!hasFullLicense() && totalRows > rows.length) {
          const status = document.getElementById("printStatus");
          const msg = demoLimitMessage("printez", totalRows, rows.length);
          if (status) status.textContent = msg;
          alert(msg);
        }
        const mode = el("printMode").value;
        const dpi = parseInt(el("dpi").value, 10);
        const wmm = parseFloat(el("wmm").value);
        const hmm = parseFloat(el("hmm").value);
        const printOffsetXmm = Number.isFinite(parseFloat(el("printOffXmm").value)) ? parseFloat(el("printOffXmm").value) : 0;
        const printOffsetYmm = Number.isFinite(parseFloat(el("printOffYmm").value)) ? parseFloat(el("printOffYmm").value) : 0;
        const printScale = clamp((Number.isFinite(parseFloat(el("printScalePct").value)) ? parseFloat(el("printScalePct").value) : 100) / 100, 0.25, 2);

        if (mode === "label" && window.AppBridge && window.AppBridge.rawPrintZpl) {
          const status = document.getElementById("printStatus");
          const printerName = (document.getElementById("printerName")?.value || "").trim();
          const zpl = makeBitmapZplBulk(rows);
          if (status) status.textContent = `Trimit Bitmap ZPL: ${rows.length} etichete...`;
          window.AppBridge.rawPrintZpl({ printerName, zpl }).then((res) => {
            if (status) status.textContent = res && res.ok ? res.message : `Eroare Bitmap ZPL: ${res && res.message ? res.message : "necunoscuta"}`;
            if (!res || !res.ok) alert("Print Bitmap ZPL esuat: " + (res && res.message ? res.message : "eroare necunoscuta"));
          });
          return;
        }

        setPrintPageStyle(mode, wmm, hmm);
        root.innerHTML = "";
        const labelImages = [];

        function preparePrintCanvas(row) {
          const baseCanvas = renderLabelToCanvas(row);
          const canvas = makePrintCanvas(baseCanvas, printOffsetXmm, printOffsetYmm, printScale, dpi);
          canvas.style.width = `${wmm}mm`;
          canvas.style.height = `${hmm}mm`;
          canvas.style.imageRendering = "pixelated";
          labelImages.push(canvas.toDataURL("image/png"));
          return canvas;
        }

        if (mode === "a4") {
          const page = document.createElement("div");
          page.className = "a4-page";
          const grid = document.createElement("div");
          grid.className = "grid";
          grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${wmm}mm, ${wmm}mm))`;

          rows.forEach((r) => {
            grid.appendChild(preparePrintCanvas(r));
          });

          page.appendChild(grid);
          root.appendChild(page);
        } else {
          rows.forEach((r, i) => {
            const page = document.createElement("div");
            page.className = "single-label-page";
            page.style.width = `${wmm}mm`;
            page.style.height = `${hmm}mm`;
            page.style.breakAfter = i === rows.length - 1 ? "auto" : "page";
            page.appendChild(preparePrintCanvas(r));
            root.appendChild(page);
          });
        }

        window.setTimeout(async () => {
          if (window.AppBridge && window.AppBridge.printLabels) {
            const res = await window.AppBridge.printLabels({
              mode,
              widthMm: wmm,
              heightMm: hmm,
              labels: labelImages
            });
            if (!res || !res.ok) alert("Print esuat: " + (res && res.message ? res.message : "eroare necunoscuta"));
            return;
          }

          alert("Print curat necesita aplicatia Electron pornita cu npm start. Nu deschide index.html direct in browser.");
        }, 80);
      }

      async function importExcel(file){
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type:"array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval:"", raw:false });

        const normalizeKey = (key) => String(key ?? "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "");
        const findKey = (keys, candidates) => {
          const normalized = keys.map((key) => ({ key, n: normalizeKey(key) }));
          return (normalized.find((x) => candidates.includes(x.n))
            || normalized.find((x) => candidates.some((c) => x.n.includes(c)))
            || {}).key;
        };
        const cell = (obj, key) => key ? String(obj[key] ?? "").trim() : "";

        const rows = json.map(obj=>{
          const keys = Object.keys(obj);
          const kSku = findKey(keys, ["sku", "continutcod", "valoarecod", "cod", "barcode", "codbare"]);
          const kTop = findKey(keys, ["textsus", "texts", "sus"]);
          const kBottom = findKey(keys, ["textjos", "testjos", "textj", "jos", "descriere", "descr"]);
          const sku = cell(obj, kSku);
          const textSus = cell(obj, kTop);
          const textJos = cell(obj, kBottom);
          return { sku, descriere: textJos, textSus, textJos, source: "excel" };
        }).filter(r=>r.sku);

        return rows;
      }

      function escapeZpl(s){
        return String(s ?? "")
          .replaceAll("^", " ")
          .replaceAll("~", " ")
          .replaceAll("\\", "/");
      }

      function dotsFromPx(px, dpi){ return Math.round((Number(px) || 0) * (dpi / 203)); }
      function zplTextField(text, y, fontHeight, xOffset, W){
        const h = Math.max(8, Math.round(fontHeight));
        const w = Math.max(6, Math.round(h * 0.75));
        const off = Math.round(xOffset || 0);
        const x = off >= 0 ? clamp(off * 2, 0, W - 1) : 0;
        const blockW = off >= 0 ? (W - x) : (W + off * 2);
        return `^FO${x},${Math.max(0, Math.round(y))}^A0N,${h},${w}^FB${Math.max(1, Math.round(blockW))},1,0,C,0^FD${escapeZpl(text)}^FS\n`;
      }

      function zplErrorLabel(message, W){
        return `^FO20,20^A0N,28,22^FB${Math.max(1, W - 40)},3,0,C,0^FD${escapeZpl(message)}^FS\n`;
      }

      function estimateBarcodeWidthDots(kind, value, moduleWidth, moduleSize, availableW){
        const len = String(value ?? "").length;
        if (kind === "ean13" || kind === "upca") return 113 * moduleWidth;
        if (kind === "ean8") return 85 * moduleWidth;
        if (kind === "code39") return (len + 2) * 16 * moduleWidth;
        if (kind === "itf14") return 100 * moduleWidth;
        if (kind === "qrcode") return 29 * moduleSize;
        if (kind === "datamatrix") return 26 * moduleSize;
        if (kind === "pdf417") return availableW;
        return Math.min(availableW, (len + 3) * 12 * moduleWidth);
      }

      function zebraBarcodeField(kind, value, x, y, height, dpi, availableW){
        const data = escapeZpl(value);
        const moduleWidth = Math.max(2, Math.round(dpi / 203));
        const linearHeight = Math.max(30, Math.round(height));
        const qrModule = clamp(Math.round((dpi / 203) * 5), 2, Math.max(2, Math.floor(height / 25)));
        const matrixModule = clamp(Math.round((dpi / 203) * 4), 2, Math.max(2, Math.floor(height / 20)));
        const estimatedW = estimateBarcodeWidthDots(kind, data, moduleWidth, kind === "qrcode" ? qrModule : matrixModule, availableW);
        const bx = clamp(Math.round(x - estimatedW / 2), 0, Math.max(0, Math.round(x + availableW / 2) - 1));
        const by = Math.max(0, Math.round(y));

        if (!data) return { ok:false, zpl:"", message:"Valoare cod lipsa" };

        if (kind === "ean13") return { ok:true, zpl:`^BY${moduleWidth},2,${linearHeight}\n^FO${bx},${by}^BEN,${linearHeight},N,N^FD${data}^FS\n` };
        if (kind === "ean8") return { ok:true, zpl:`^BY${moduleWidth},2,${linearHeight}\n^FO${bx},${by}^B8N,${linearHeight},N,N^FD${data}^FS\n` };
        if (kind === "code128") return { ok:true, zpl:`^BY${moduleWidth},2,${linearHeight}\n^FO${bx},${by}^BCN,${linearHeight},N,N,N^FD${data}^FS\n` };
        if (kind === "qrcode") return { ok:true, zpl:`^FO${bx},${by}^BQN,2,${qrModule},Q,7^FDQA,${data}^FS\n` };
        if (kind === "datamatrix") return { ok:true, zpl:`^FO${bx},${by}^BXN,${matrixModule},200,,,,,1^FD${data}^FS\n` };
        if (kind === "pdf417") {
          const rowHeight = Math.max(3, Math.round((dpi / 203) * 4));
          return { ok:true, zpl:`^BY${moduleWidth},3,${linearHeight}\n^FO${Math.max(0, Math.round(x - availableW / 2))},${by}^B7N,${rowHeight},5,,,N^FD${data}^FS\n` };
        }
        if (kind === "code39") return { ok:true, zpl:`^BY${moduleWidth},2,${linearHeight}\n^FO${bx},${by}^B3N,N,${linearHeight},N,N^FD${data}^FS\n` };
        if (kind === "upca") return { ok:true, zpl:`^BY${moduleWidth},2,${linearHeight}\n^FO${bx},${by}^BUN,${linearHeight},N,N,N^FD${data}^FS\n` };
        if (kind === "itf14") return { ok:true, zpl:`^BY${moduleWidth},3,${linearHeight}\n^FO${bx},${by}^B2N,${linearHeight},N,N,N^FD${data}^FS\n` };

        return { ok:false, zpl:"", message:`Tip cod neacceptat in ZPL Zebra: ${kind}` };
      }

      function makeZplForRow(row){
        const dpi = parseInt(el("dpi").value, 10);
        const wmm = parseFloat(el("wmm").value);
        const hmm = parseFloat(el("hmm").value);
        const W = mmToDots(wmm, dpi);
        const H = mmToDots(hmm, dpi);
        const printShiftX = mmToDots(Number.isFinite(parseFloat(el("printOffXmm").value)) ? parseFloat(el("printOffXmm").value) : 0, dpi);
        const printShiftY = mmToDots(Number.isFinite(parseFloat(el("printOffYmm").value)) ? parseFloat(el("printOffYmm").value) : 0, dpi);
        const pad = Math.max(4, dotsFromPx(parseInt(el("padPx").value,10), dpi));
        const gap = Math.max(0, dotsFromPx(parseInt(el("textGapPx").value,10), dpi));
        const forceBarcodeHPx = parseInt(el("forceBarcodeHPx").value, 10) || 0;
        const fonts = parseFontPair(el("fontPx").value);

        const bcOffX = mmToDots(parseFloat(el("bcOffXmm").value) || 0, dpi);
        const bcOffY = mmToDots(parseFloat(el("bcOffYmm").value) || 0, dpi);
        const topOffX = mmToDots(parseFloat(el("topOffXmm").value) || 0, dpi);
        const topOffY = mmToDots(parseFloat(el("topOffYmm").value) || 0, dpi);
        const botOffX = mmToDots(parseFloat(el("botOffXmm").value) || 0, dpi);
        const botOffY = mmToDots(parseFloat(el("botOffYmm").value) || 0, dpi);

        const topText = rowTopText(row);
        const bottomText = rowBottomText(row);
        const topH = topText ? dotsFromPx(fonts.top, dpi) : 0;
        const botH = bottomText ? dotsFromPx(fonts.bottom, dpi) : 0;

        const topY = pad + topOffY;
        const bottomY = H - pad - botH + botOffY;
        const barTop = topText ? (topY + topH + gap) : pad;
        const barBottom = bottomText ? (bottomY - gap) : (H - pad);
        let barHeight = Math.max(24, barBottom - barTop);
        if (forceBarcodeHPx > 0) barHeight = Math.min(barHeight, dotsFromPx(forceBarcodeHPx, dpi));
        const barCenterX = (W / 2) + bcOffX + printShiftX;
        const barY = clamp(barTop + bcOffY + printShiftY, 0, Math.max(0, H - barHeight - pad));
        const availableW = Math.max(1, W - pad * 2);

        const chosen = getBcid();
        const rawSku = String(row.sku ?? "").trim();
        const vEan = UI.validateEan(chosen, rawSku);
        const sku = vEan.render || vEan.digits || rawSku;

        let z = "^XA\n^CI28\n";
        z += `^PW${W}\n^LL${H}\n^LH0,0\n`;
        if (!vEan.ok){ z += zplErrorLabel(vEan.msg, W); z += "^XZ\n"; return z; }
        if (topText) z += zplTextField(topText, topY + printShiftY, topH, topOffX + printShiftX, W);
        const barcode = zebraBarcodeField(chosen, sku, barCenterX, barY, barHeight, dpi, availableW);
        z += barcode.ok ? barcode.zpl : zplErrorLabel(barcode.message, W);
        if (bottomText) z += zplTextField(bottomText, bottomY + printShiftY, botH, botOffX + printShiftX, W);
        z += "^XZ\n";
        return z;
      }
      function makeZplBulk(rows){ return makeBitmapZplBulk(rows); }

      // Bind UI
      el("btnPreview").addEventListener("click", doPreview);
      el("btnPrint").addEventListener("click", doPrint);
      el("btnRenewLicense").addEventListener("click", () => el("licenseFile").click());
      ["btnContactLicense", "btnLicenseEmail", "btnLicenseEmailText"].forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.addEventListener("click", contactLicense);
      });
      window.addEventListener("keydown", (ev) => {
        if ((ev.ctrlKey || ev.metaKey) && String(ev.key || "").toLowerCase() === "p") {
          ev.preventDefault();
          doPrint();
        }
      });
      el("btnAddManual").addEventListener("click", ()=>{
        const sku = el("manualSku").value.trim();
        const descriere = el("manualDesc").value.trim();
        if (!sku) return;
        if (!hasFullLicense() && state.rows.length >= policyMaxLabels()){
          alert(`DEMO: maxim ${state.policy.maxLabels} etichete în listă.`);
          return;
        }
        state.rows.push({ sku, descriere, source: "manual" });
        refreshTable();
        doPreview();
      });
      el("btnClear").addEventListener("click", ()=>{ state.rows=[]; refreshTable(); el("preview").innerHTML=""; });

      el("file").addEventListener("change", async (ev)=>{
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        const rows = await importExcel(file);
        const room = hasFullLicense() ? rows.length : Math.max(0, policyMaxLabels() - state.rows.length);
        const toAdd = hasFullLicense() ? rows : rows.slice(0, room);
        state.rows.push(...toAdd);
        refreshTable();
        doPreview();
        if (!hasFullLicense() && rows.length > toAdd.length){
          alert(`DEMO: am importat doar ${toAdd.length} rânduri (limită ${state.policy.maxLabels}).`);
        }
        el("file").value = "";
      });

      el("btnExportZpl").addEventListener("click", ()=>{
        if (state.policy.allowExportZpl === false) return alert("Export ZPL este disponibil doar cu licenta activa.");
        if (!(state.license.ok && !state.license.inGrace) && !state.policy.allowExportZpl) return alert("READ-ONLY: Export ZPL este blocat (necesită reînnoire).");
        const rows = rowsForWork();
        const zpl = makeZplBulk(rows);
        const blob = new Blob([zpl], { type:"text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "labels.zpl";
        a.click();
        URL.revokeObjectURL(a.href);
      });

      el("btnSendZpl").addEventListener("click", async ()=>{
        if (state.policy.allowSendZpl === false) return alert("Trimiterea ZPL este disponibila doar cu licenta activa.");
        if (!(state.license.ok && !state.license.inGrace) && !state.policy.allowSendZpl) return alert("READ-ONLY: Trimiterea ZPL este blocată (necesită reînnoire).");
        const ip = el("zebraIp").value.trim();
        if (!ip) return alert("Scrie IP-ul imprimantei (ex: 192.168.1.50)");
        const rows = rowsForWork();
        const zpl = makeZplBulk(rows);
        el("zplSendStatus").textContent = "Trimit...";
        const res = await window.AppBridge.sendZplTcp9100({ host: ip, port: 9100, zpl });
        el("zplSendStatus").textContent = res.ok ? ("OK: " + res.message) : ("FAIL: " + res.message);
      });

      el("licenseFile").addEventListener("change", async (ev)=>{
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        state.license = await License.importLicenseFile(f);
        state.policy = License.policyFromLicense ? License.policyFromLicense(state.license) : (hasFullLicense() ? { maxLabels: 999999, allowExportZpl:true, allowSendZpl:true, allowPrint:true, watermark:"" } : License.demoPolicy());
        if (!state.license.ok) alert("Licență invalidă: " + (state.license.reason || "unknown"));
        const trimmed = enforceListLimit();
        applyPolicyToUI();
        updateLicenseUI();
        if (trimmed) refreshTable();
        doPreview();
        ev.target.value = "";
      });

      ["bcid","bcidCustom","manualSku","manualQty","excelQty","topTpl","bottomTpl"].forEach(id=>{
        const n = document.getElementById(id);
        if (n) n.addEventListener("input", ()=>{ updateBcidStatus(); doPreview(); });
      });
      const printerSelect = document.getElementById("printerName");
      if (printerSelect) {
        printerSelect.addEventListener("change", () => {
          const status = document.getElementById("printStatus");
          const active = printerSelect.options[printerSelect.selectedIndex];
          if (status) status.textContent = `Print Bitmap ZPL: ${active ? active.textContent : "imprimanta implicita"}.`;
        });
      }

      // Init
      applyPreset();
      updateBcidStatus();
      refreshTable();
      doPreview();
      initLicense();
      loadPrinterList();

      function setUpdateUi(status){
        const statusEl = document.getElementById("updateStatus");
        const installBtn = document.getElementById("btnInstallUpdate");
        if (!statusEl) return;
        const message = status && status.message ? status.message : "Update: in asteptare.";
        statusEl.textContent = message;
        if (installBtn) installBtn.classList.toggle("hidden", !(status && status.state === "downloaded"));
      }

      (async ()=>{
        const versionEl = document.getElementById("appVersion");
        const checkBtn = document.getElementById("btnCheckUpdate");
        const installBtn = document.getElementById("btnInstallUpdate");

        if (window.AppBridge && window.AppBridge.getAppVersion && versionEl) {
          const version = await window.AppBridge.getAppVersion();
          versionEl.textContent = `v${version}`;
        }

        if (window.AppBridge && window.AppBridge.getUpdateStatus) {
          setUpdateUi(await window.AppBridge.getUpdateStatus());
        }
        if (window.AppBridge && window.AppBridge.onUpdateStatus) {
          window.AppBridge.onUpdateStatus(setUpdateUi);
        }
        if (checkBtn && window.AppBridge && window.AppBridge.checkForUpdates) {
          checkBtn.addEventListener("click", async () => {
            setUpdateUi({ state: "checking", message: "Verific update..." });
            const res = await window.AppBridge.checkForUpdates();
            if (res && res.ok === false && res.message) setUpdateUi({ state: "error", message: res.message });
          });
        }
        if (installBtn && window.AppBridge && window.AppBridge.installUpdate) {
          installBtn.addEventListener("click", async () => {
            installBtn.disabled = true;
            setUpdateUi({ state: "installing", message: "Instalez update..." });
            await window.AppBridge.installUpdate();
          });
        }
      })();

      // Machine ID display + copy
      (async ()=>{
        try {
          const mid = await window.AppBridge.getMachineId();
          const inp = document.getElementById("machineId");
          const btn = document.getElementById("btnCopyMachineId");
          if (inp) inp.value = mid;
          if (btn) {
            btn.addEventListener("click", async ()=>{
              await navigator.clipboard.writeText(mid);
              alert("Machine ID copiat în clipboard.");
            });
          }
        } catch(e){ console.error(e); }
      })();


    } catch (e){
      showFatal(e);
    }
  });
})();

// ===== Machine ID (afișare + copiere) =====
async function __loadMachineId() {
  const el = document.getElementById('machineIdValue');
  const btn = document.getElementById('btnCopyMachineId');
  if (!el) return;

  try {
    if (!window.licenseAPI || !window.licenseAPI.getMachineId) {
      el.textContent = '—';
      console.warn('licenseAPI.getMachineId nu este disponibil');
      return;
    }

    const id = await window.licenseAPI.getMachineId();
    el.textContent = id || '—';

    if (btn && id) {
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(id);
          btn.textContent = 'Copiat ✓';
          setTimeout(() => (btn.textContent = 'Copiază'), 1200);
        } catch (e) {
          alert('Nu pot copia automat. Selectează manual Machine ID.');
        }
      });
    }
  } catch (e) {
    console.error('Eroare Machine ID:', e);
    el.textContent = '—';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', __loadMachineId);
} else {
  __loadMachineId();
}
