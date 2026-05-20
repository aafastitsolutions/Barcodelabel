(function(){
  function b64ToU8(b64){
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  // Production mode: license is required for full use.
  const ADMIN_MODE = false;

  const LICENSE_PUBLIC_KEY_B64 = "l2+bitFqk1JIgnnFedfZZNjX7b3TutqRNkvBCJC1SPY=";

  function adminPolicy(){
    return { maxLabels: 999999, allowExportZpl: true, allowSendZpl: true, allowPrint: true, watermark: "" };
  }

  function adminLicense(){
    return {
      ok: true,
      isAdmin: true,
      payload: {
        plan: "ADMIN_LOCAL",
        customer: "Local admin",
        licenseId: "LOCAL-ADMIN",
        expires: ""
      },
      daysLeft: null,
      inGrace: false
    };
  }

  // Demo mode: usable, but limited to 5 labels and no export/send.
  function demoPolicy(){
    return { maxLabels: 5, allowExportZpl: false, allowSendZpl: false, allowPrint: true, watermark: "" };
  }

  function daysBetween(a, b){
    const MS = 24 * 60 * 60 * 1000;
    return Math.floor((b.getTime() - a.getTime()) / MS);
  }

  async function loadLicenseFromStorage(){
    if (ADMIN_MODE) return adminLicense();

    let raw = localStorage.getItem("licenseFile");
    if (!raw && window.AppBridge && window.AppBridge.readAutoLicense) {
      try {
        const auto = await window.AppBridge.readAutoLicense();
        if (auto) {
          localStorage.setItem("licenseFile", auto);
          raw = auto;
        }
      } catch(e){}
    }
    if (!raw) return { ok:false, reason:"no_license" };

    try {
      const obj = JSON.parse(raw);
      if (!obj.payload || !obj.sig) return { ok:false, reason:"bad_format" };
      if (!LICENSE_PUBLIC_KEY_B64 || LICENSE_PUBLIC_KEY_B64 === "PASTE_PUBLIC_KEY_HERE") {
        return { ok:false, reason:"missing_public_key" };
      }

      const pub = b64ToU8(LICENSE_PUBLIC_KEY_B64);
      const sig = b64ToU8(obj.sig);
      const payloadJson = JSON.stringify(obj.payload);

      const valid = nacl.sign.detached.verify(
        new TextEncoder().encode(payloadJson),
        sig,
        pub
      );
      if (!valid) return { ok:false, reason:"bad_signature" };

      // machine binding
      const machineId = await window.AppBridge.getMachineId();
      if (obj.payload.machineId && obj.payload.machineId !== machineId) {
        return { ok:false, reason:"wrong_machine", payload: obj.payload };
      }

      // expiry + optional grace period
      const p = obj.payload || {};
      const graceDays = Number.isFinite(p.graceDays) ? p.graceDays : parseInt(p.graceDays || "0", 10) || 0;

      if (p.expires) {
        const exp = new Date(p.expires + "T23:59:59");
        if (!Number.isFinite(exp.getTime())) {
          return { ok:false, reason:"bad_expiry", payload: p };
        }
        const now = new Date();

        if (now <= exp) {
          return { ok:true, payload: p, daysLeft: daysBetween(now, exp), inGrace: false };
        }

        const expPlusGrace = new Date(exp.getTime() + graceDays * 24*60*60*1000);
        if (graceDays > 0 && now <= expPlusGrace) {
          const overdue = daysBetween(exp, now); // >= 0
          return { ok:true, payload: p, daysLeft: -overdue, inGrace: true };
        }

        return { ok:false, reason:"expired", payload: p };
      }

      // no expiry => perpetual
      return { ok:true, payload: p, daysLeft: null, inGrace: false };

    } catch {
      return { ok:false, reason:"parse_error" };
    }
  }

  async function importLicenseText(txt){
    localStorage.setItem("licenseFile", txt);
    return await loadLicenseFromStorage();
  }

  async function importLicenseFile(file){
    const txt = await file.text();
    return await importLicenseText(txt);
  }

  function policyFromLicense(res){
    if (res && res.ok && !res.inGrace){
      const p = res.payload || {};
      const features = p.features || ["ALL"];
      const hasAll = Array.isArray(features)
        ? features.includes("ALL")
        : !!features.all;
      const hasFeature = (name, objectName) => {
        if (hasAll) return true;
        if (Array.isArray(features)) return features.includes(name);
        return !!features[objectName];
      };

      const maxLabels = Number.isFinite(p.maxLabels) ? p.maxLabels : parseInt(p.maxLabels || "999999", 10);

      return {
        maxLabels: Number.isFinite(maxLabels) && maxLabels > 0 ? maxLabels : 999999,
        allowExportZpl: hasFeature("EXPORT_ZPL", "zplExport"),
        allowSendZpl: hasFeature("SEND_ZPL", "zplSend"),
        allowPrint: true,
        watermark: ""
      };
    }
    return demoPolicy();
  }

  window.License = { LICENSE_PUBLIC_KEY_B64, ADMIN_MODE, adminPolicy, demoPolicy, loadLicenseFromStorage, importLicenseText, importLicenseFile, policyFromLicense };
})();
