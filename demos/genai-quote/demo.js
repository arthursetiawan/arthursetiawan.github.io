(() => {
  const DEFAULT_QUOTE = `QUOTE REF: Q-8842-MX (partial scan)
Vendor: Pacific Parts Supply — attn. J. Rivera
Date: 02/14/26 (smudged)

Line items (OCR messy):
  1) BRAKE PAD SET - FLT ceramic x4 .............. qty 12 @ $48.5 ea
  2) Air Filter  - OEM equiv P/N AF-2210 .......... qty 30  @$11.9
  3) "water pumpassy" w/p gasket kit ............... Qty:6  $189
  4) headlamp assy LH w/ LED (compat TBD) ......... 2 units 279.00USD
  Notes: rush fee waived; tax unknown; ??? line 5 illegible`;

  const CATALOG = [
    { sku: "BRK-4410-C", name: "Brake pad set — ceramic", unit_price: 47.95 },
    { sku: "FLT-AF-2210", name: "Engine air filter OEM spec", unit_price: 12.1 },
    { sku: "ENG-WP-908", name: "Water pump assembly w/ gasket", unit_price: 185.0 },
    { sku: "LTG-HL-LED-L", name: "Headlamp assembly LH LED", unit_price: 275.0 },
    { sku: "SUS-ST-114", name: "Strut assembly front", unit_price: 210.0 },
  ];

  const EXTRACTED = [
    { raw: "BRAKE PAD SET - FLT ceramic", qty: 12, unit: 48.5, catalogIdx: 0, score: 96 },
    { raw: "Air Filter OEM AF-2210", qty: 30, unit: 11.9, catalogIdx: 1, score: 91 },
    { raw: "water pumpassy w/p gasket", qty: 6, unit: 189, catalogIdx: 2, score: 88 },
    { raw: "headlamp assy LH w/ LED", qty: 2, unit: 279, catalogIdx: 3, score: 84 },
  ];

  const textarea = document.getElementById("quote-text");
  const output = document.getElementById("extract-output");
  const jsonPre = document.getElementById("json-preview");
  const btn = document.getElementById("btn-extract");
  const year = document.getElementById("year");

  if (year) year.textContent = String(new Date().getFullYear());
  textarea.value = DEFAULT_QUOTE;

  function scoreClass(s) {
    if (s >= 90) return "match-score";
    if (s >= 85) return "match-score match-score--mid";
    return "match-score match-score--low";
  }

  function money(n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  }

  function buildJson() {
    return {
      source: "synthetic_quote_q8842",
      model: "mock-gemini-extract-v0",
      line_items: EXTRACTED.map((row) => ({
        description_raw: row.raw,
        quantity: row.qty,
        unit_price: row.unit,
        catalog_match: {
          sku: CATALOG[row.catalogIdx].sku,
          name: CATALOG[row.catalogIdx].name,
          fuzzy_score: row.score,
        },
      })),
    };
  }

  function renderTable(animate) {
    const rows = EXTRACTED.map((row, i) => {
      const cat = CATALOG[row.catalogIdx];
      const hidden = animate ? "is-hidden" : "is-visible";
      return `<tr class="${hidden}" data-row="${i}">
        <td>${row.raw}</td>
        <td>${row.qty}</td>
        <td>${money(row.unit)}</td>
        <td>${cat.sku}<br /><small>${cat.name}</small></td>
        <td><span class="${scoreClass(row.score)}">${row.score}</span></td>
      </tr>`;
    }).join("");

    output.innerHTML = `
      <div class="json-table-wrap">
      <table class="json-table" aria-label="Extracted line items">
        <thead>
          <tr>
            <th>Raw description</th>
            <th>Qty</th>
            <th>Unit $</th>
            <th>Catalog match</th>
            <th>Fuzzy score</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      </div>
    `;

    const payload = buildJson();
    jsonPre.textContent = JSON.stringify(payload, null, 2);

    if (!animate) return;
    const trs = output.querySelectorAll("tbody tr");
    trs.forEach((tr, i) => {
      window.setTimeout(() => tr.classList.replace("is-hidden", "is-visible"), 120 * i + 80);
    });
  }

  btn.addEventListener("click", () => {
    output.innerHTML = `<p class="placeholder">Extracting…</p>`;
    jsonPre.textContent = "";
    window.setTimeout(() => renderTable(true), 420);
  });
})();
