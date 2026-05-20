(function(){
  function el(id){ return document.getElementById(id); }
  function escapeHtml(s){
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }
  function digitsOnly(s){ return String(s ?? "").replace(/\D/g, ""); }

  function ean13Check(d12){
    let sum = 0;
    for (let i=0;i<12;i++){
      const n = d12.charCodeAt(i) - 48;
      sum += (i % 2 === 0) ? n : (n * 3);
    }
    return String((10 - (sum % 10)) % 10);
  }

  function ean8Check(d7){
    let sum = 0;
    for (let i=0;i<7;i++){
      const n = d7.charCodeAt(i) - 48;
      sum += (i % 2 === 0) ? (n * 3) : n;
    }
    return String((10 - (sum % 10)) % 10);
  }

  function sscc18Check(d17){
    let sum = 0;
    for (let i=0;i<17;i++){
      const n = d17.charCodeAt(i) - 48;
      sum += (i % 2 === 0) ? (n * 3) : n;
    }
    return String((10 - (sum % 10)) % 10);
  }

  function validateEan(bcid, sku){
    const d = digitsOnly(sku);

    if (bcid === "ean13") {
      if (!(d.length === 12 || d.length === 13)) {
        return { ok:false, digits:d, render:d, msg:`EAN-13 cere 12 sau 13 cifre (ai ${d.length})` };
      }
      const base = d.slice(0,12);
      const cd = ean13Check(base);
      const fixed13 = base + cd;

      if (d.length === 13 && d[12] !== cd) {
        return { ok:true, digits:fixed13, render:base, msg:`EAN-13: checksum corectat (${d[12]}->${cd})` };
      }
      return { ok:true, digits:fixed13, render:base, msg:"EAN-13 OK" };
    }

    if (bcid === "ean8") {
      if (!(d.length === 7 || d.length === 8)) {
        return { ok:false, digits:d, render:d, msg:`EAN-8 cere 7 sau 8 cifre (ai ${d.length})` };
      }
      const base = d.slice(0,7);
      const cd = ean8Check(base);
      const fixed8 = base + cd;

      if (d.length === 8 && d[7] !== cd) {
        return { ok:true, digits:fixed8, render:base, msg:`EAN-8: checksum corectat (${d[7]}->${cd})` };
      }
      return { ok:true, digits:fixed8, render:base, msg:"EAN-8 OK" };
    }

    if (bcid === "sscc18") {
      if (!(d.length === 17 || d.length === 18)) {
        return { ok:false, digits:d, render:d, msg:`SSCC-18 cere 17 sau 18 cifre (ai ${d.length})` };
      }
      const base = d.slice(0,17);
      const cd = sscc18Check(base);
      const fixed18 = base + cd;
      const render = `(00)${fixed18}`;

      if (d.length === 18 && d[17] !== cd) {
        return { ok:true, digits:fixed18, render, msg:`SSCC-18: checksum corectat (${d[17]}->${cd})` };
      }
      return { ok:true, digits:fixed18, render, msg:"SSCC-18 OK" };
    }

    return { ok:true, digits:String(sku ?? "").trim(), render:String(sku ?? "").trim(), msg:"-" };
  }

  window.UI = { el, escapeHtml, digitsOnly, validateEan };
})();
