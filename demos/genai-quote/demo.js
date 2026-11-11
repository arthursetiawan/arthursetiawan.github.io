const REVIEW_THRESHOLD = 0.4;
const PART_WEIGHT = 0.5;
const PRICE_WEIGHT = 0.4;
const VENDOR_WEIGHT = 0.1;

const sampleSelect = document.getElementById("sample-select");
const customToggle = document.getElementById("custom-toggle");
const invoiceText = document.getElementById("invoice-text");
const invoiceLabel = document.getElementById("invoice-label");
const runBtn = document.getElementById("run-btn");
const resetBtn = document.getElementById("reset-btn");
const results = document.getElementById("results");
const resultsBody = document.getElementById("results-body");
const stageStatus = document.getElementById("stage-status");
const resultsSummary = document.getElementById("results-summary");
const extractBody = document.querySelector("#extract-table tbody");
const reconcileBody = document.querySelector("#reconcile-table tbody");

/** @type {Record<string, any>} */
let fixtures = {};

const MOCK_CATALOG = [
  { part_number: "BRK-0007-4412", description: "Brake pad set Front Bosch", unit_price: 64.5, vendor: "Bosch" },
  { part_number: "BRK-0020-4432", description: "Brake pad set Front ceramic", unit_price: 68.2, vendor: "Bosch" },
  { part_number: "BRK-0027-1190", description: "Brake pad set Rear Motorcraft", unit_price: 92.1, vendor: "Motorcraft" },
  { part_number: "BRK-0440-1693", description: "Brake pad set Rear Bosch", unit_price: 88.35, vendor: "Bosch" },
  { part_number: "FLT-0012-8831", description: "Oil filter Universal Mann-Filter", unit_price: 12.75, vendor: "Mann-Filter" },
  { part_number: "FLT-0061-2163", description: "Oil filter Universal", unit_price: 13.4, vendor: "Mann-Filter" },
  { part_number: "ALT-0023-5501", description: "Alternator reman Front Denso", unit_price: 188.0, vendor: "Denso" },
  { part_number: "ALT-0042-3591", description: "Alternator reman Front", unit_price: 192.5, vendor: "Denso" },
  { part_number: "WP-0034-2204", description: "Water pump Front Gates", unit_price: 74.25, vendor: "Gates" },
  { part_number: "WP-0485-4509", description: "Water pump Front NTK", unit_price: 66.55, vendor: "NTK" },
  { part_number: "SEN-0041-7730", description: "O2 sensor Upstream NTK", unit_price: 48.6, vendor: "NTK" },
  { part_number: "HUB-0055-9012", description: "Wheel hub bearing RH Timken", unit_price: 129.99, vendor: "Timken" },
  { part_number: "HUB-0209-6590", description: "Wheel hub bearing RH", unit_price: 124.0, vendor: "Timken" },
  { part_number: "STR-0103-3200", description: "Gasket assortment", unit_price: 18.5, vendor: "Generic" },
];

function money(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `$${Number(value).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function tokenize(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function tokenSetRatio(a, b) {
  const aa = new Set(tokenize(a));
  const bb = new Set(tokenize(b));
  if (!aa.size || !bb.size) return 0;
  let inter = 0;
  for (const t of aa) if (bb.has(t)) inter += 1;
  const union = new Set([...aa, ...bb]).size;
  return inter / union;
}

function partialRatio(a, b) {
  const s1 = String(a || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const s2 = String(b || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s1 || !s2) return 0;
  if (s1.includes(s2) || s2.includes(s1)) return 1;
  const shorter = s1.length <= s2.length ? s1 : s2;
  const longer = s1.length <= s2.length ? s2 : s1;
  let best = 0;
  for (let i = 0; i <= longer.length - shorter.length; i += 1) {
    const slice = longer.slice(i, i + shorter.length);
    let match = 0;
    for (let j = 0; j < shorter.length; j += 1) if (shorter[j] === slice[j]) match += 1;
    best = Math.max(best, match / shorter.length);
  }
  return best;
}

function partTokenScore(extracted, catalog) {
  return 0.6 * tokenSetRatio(extracted, catalog) + 0.4 * partialRatio(extracted, catalog);
}

function priceProximityScore(extracted, catalog) {
  if (extracted < 0 || catalog < 0) return 0;
  const denom = Math.max(Math.abs(catalog), Math.abs(extracted), 1);
  const gap = Math.abs(extracted - catalog) / denom;
  return Math.max(0, 1 - gap);
}

function vendorSimilarityScore(extracted, catalog) {
  return tokenSetRatio(extracted, catalog);
}

function fallbackBounds(unitCost) {
  const span = Math.max(unitCost * 0.15, 2);
  return {
    low: Math.max(0, Math.round((unitCost - span) * 100) / 100),
    high: Math.round((unitCost + span) * 100) / 100,
  };
}

function normalizePartNumber(raw) {
  const cleaned = String(raw).replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
  let m = cleaned.match(/^([A-Z]+)(\d{4,})(\d{4})$/);
  if (m) return `${m[1]}-${m[2].slice(-4)}-${m[3]}`;
  m = cleaned.match(/^([A-Z]+)(\d+)$/);
  if (m && m[2].length >= 8) {
    const digits = m[2];
    return `${m[1]}-${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
  }
  return String(raw).trim().toUpperCase();
}

function parsePipeLine(line) {
  const parts = line.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  if (!/^[A-Z0-9][A-Z0-9\-_/]{2,}$/i.test(parts[0])) return null;
  const moneyMatch = parts[2].match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!moneyMatch) return null;
  let competitor = null;
  if (parts.length >= 5) {
    const c = parts[4].match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
    if (c) competitor = Number(c[1]);
  }
  return {
    PartNumber: parts[0],
    Description: parts[1],
    UnitCost: Number(moneyMatch[1]),
    CompetitorPrice: competitor,
    Vendor: parts[3] || "Unknown",
  };
}

function extractFromText(text, sourceName = "custom_paste") {
  const blocks = text
    .trim()
    .split(/\n\s*-{3,}\s*\n|\n\s*={3,}\s*\n|\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const items = [];
  let vendorHint = null;

  for (const block of blocks) {
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const pipeItems = lines.map(parsePipeLine).filter(Boolean);
    if (pipeItems.length) {
      items.push(...pipeItems);
      vendorHint = vendorHint || pipeItems[0].Vendor;
      continue;
    }

    const joined = lines.join("\n");
    const partMatch =
      joined.match(
        /(?:part\s*(?:number|#|no\.?)|pn|sku|part#)\s*[:=]?\s*([A-Za-z0-9][A-Za-z0-9\s\-_/]{2,})/i
      ) || joined.match(/\b([A-Z]{2,5}[\s\-_]*\d{3,5}[\s\-_]*\d{3,5})\b/i);
    if (!partMatch) continue;

    const amounts = {};
    const moneyRe =
      /(?<label>unit\s*cost|competitor\s*price|price|cost)\s*[:=]?\s*\$?\s*(?<amount>\d+(?:\.\d{1,2})?)/gi;
    let m;
    while ((m = moneyRe.exec(joined))) {
      const key = m.groups.label.toLowerCase();
      const amount = Number(m.groups.amount);
      if (key.includes("competitor")) amounts.competitor = amount;
      else amounts.unit = amount;
    }
    if (amounts.unit == null) continue;

    const vendorMatch =
      joined.match(/vend(?:or|r)\s*[:=]?\s*([A-Za-z0-9 &\-./]+)/i) ||
      joined.match(/supplier\s*[:=]?\s*([A-Za-z0-9 &\-./]+)/i);
    const descMatch =
      joined.match(/desc(?:ryption|ription)?\s*[:=]?\s*(.+)$/im) ||
      joined.match(/item\s*[:=]?\s*(.+)$/im);

    const vendor = vendorMatch ? vendorMatch[1].trim() : "Unknown";
    vendorHint = vendorHint || vendor;

    items.push({
      PartNumber: normalizePartNumber(partMatch[1]),
      Description: descMatch ? descMatch[1].trim() : partMatch[1].trim(),
      UnitCost: amounts.unit,
      CompetitorPrice: amounts.competitor ?? null,
      Vendor: vendor,
    });
  }

  return {
    source_name: sourceName,
    vendor_hint: vendorHint,
    currency: "USD",
    line_items: items,
    raw_notes: "client-side mock heuristic extraction",
  };
}

function reconcileLines(lineItems) {
  return lineItems.map((item) => {
    let best = null;
    let bestConfidence = -1;
    let breakdown = null;

    for (const part of MOCK_CATALOG) {
      const partScore = partTokenScore(item.PartNumber, part.part_number);
      const priceScore = priceProximityScore(item.UnitCost, part.unit_price);
      const vendorScore = vendorSimilarityScore(item.Vendor, part.vendor);
      const confidence =
        PART_WEIGHT * partScore + PRICE_WEIGHT * priceScore + VENDOR_WEIGHT * vendorScore;
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        breakdown = { partScore, priceScore, vendorScore, confidence };
        best = part;
      }
    }

    const confidence = Math.round((breakdown?.confidence || 0) * 10000) / 10000;
    const needsReview = confidence < REVIEW_THRESHOLD;
    const bounds = needsReview ? fallbackBounds(item.UnitCost) : null;

    return {
      PartNumber: item.PartNumber,
      Description: item.Description,
      UnitCost: item.UnitCost,
      CompetitorPrice: item.CompetitorPrice,
      Vendor: item.Vendor,
      MatchedPart: best?.part_number ?? null,
      MatchedDesc: best?.description ?? null,
      MatchedVendor: best?.vendor ?? null,
      MatchedPrice: best?.unit_price ?? null,
      Confidence: confidence,
      NeedsReview: needsReview,
      FallbackLow: bounds?.low ?? null,
      FallbackHigh: bounds?.high ?? null,
      Reason: best
        ? `matched ${best.part_number} @ confidence ${confidence.toFixed(4)}`
        : "no catalog match",
    };
  });
}

function currentSampleKey() {
  return sampleSelect.value;
}

function loadSampleIntoEditor() {
  const key = currentSampleKey();
  const sample = fixtures[key];
  if (!sample) return;
  invoiceText.value = sample.text;
  invoiceText.readOnly = !customToggle.checked;
  invoiceLabel.textContent = customToggle.checked ? "Custom invoice / quote text" : "Sample invoice text";
}

function setCustomMode(enabled) {
  invoiceText.readOnly = !enabled;
  sampleSelect.disabled = enabled;
  invoiceLabel.textContent = enabled ? "Custom invoice / quote text" : "Sample invoice text";
  if (!enabled) loadSampleIntoEditor();
  else if (!invoiceText.value.trim()) invoiceText.value = "";
  invoiceText.focus();
}

function renderExtractTable(items) {
  extractBody.innerHTML = items
    .map(
      (item) => `<tr>
        <td><code>${escapeHtml(item.PartNumber)}</code></td>
        <td>${escapeHtml(item.Description)}</td>
        <td>${money(item.UnitCost)}</td>
        <td>${money(item.CompetitorPrice)}</td>
        <td>${escapeHtml(item.Vendor)}</td>
      </tr>`
    )
    .join("");
}

function renderReconcileTable(rows) {
  reconcileBody.innerHTML = rows
    .map((row) => {
      const confClass = row.NeedsReview ? "is-low" : "is-ok";
      const badge = row.NeedsReview
        ? `<span class="badge badge-review">Human review</span>`
        : `<span class="badge badge-ok">Auto-matched</span>`;
      const fallback =
        row.NeedsReview && row.FallbackLow != null
          ? `${money(row.FallbackLow)} – ${money(row.FallbackHigh)}`
          : "—";
      return `<tr class="${row.NeedsReview ? "is-review" : ""}">
        <td><code>${escapeHtml(row.PartNumber)}</code></td>
        <td>${escapeHtml(row.Vendor)}</td>
        <td>${money(row.UnitCost)}</td>
        <td class="matched-cell">
          <strong>${escapeHtml(row.MatchedPart || "—")}</strong>
          <span>${escapeHtml(row.MatchedDesc || "")}${
            row.MatchedVendor ? ` · ${escapeHtml(row.MatchedVendor)}` : ""
          }${row.MatchedPrice != null ? ` · ${money(row.MatchedPrice)}` : ""}</span>
        </td>
        <td><span class="confidence ${confClass}">${Number(row.Confidence).toFixed(2)}</span></td>
        <td>${badge}</td>
        <td class="fallback-cell">${fallback}</td>
      </tr>`;
    })
    .join("");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDemo() {
  const text = invoiceText.value.trim();
  if (!text) {
    results.hidden = false;
    stageStatus.hidden = true;
  stageStatus.classList.add('is-done');
    resultsBody.hidden = true;
    resultsSummary.textContent = "No text to extract.";
    return;
  }

  runBtn.disabled = true;
  results.hidden = false;
  stageStatus.hidden = false;
  stageStatus.classList.remove('is-done');
  resultsBody.hidden = true;
  resultsSummary.textContent = "";

  await sleep(520);

  let quote;
  let rows;

  if (!customToggle.checked && fixtures[currentSampleKey()]) {
    const fixture = fixtures[currentSampleKey()];
    quote = fixture.quote;
    rows = fixture.rows;
  } else {
    quote = extractFromText(text, "custom_paste");
    rows = reconcileLines(quote.line_items);
  }

  stageStatus.hidden = true;
  stageStatus.classList.add('is-done');
  resultsBody.hidden = false;

  if (!rows.length) {
    extractBody.innerHTML = "";
    reconcileBody.innerHTML = "";
    resultsSummary.textContent = "No line items extracted from this text.";
    runBtn.disabled = false;
    return;
  }

  const reviewCount = rows.filter((r) => r.NeedsReview).length;
  resultsSummary.textContent = `Matched ${rows.length - reviewCount}/${rows.length} above threshold; ${reviewCount} flagged for human review.`;
  renderExtractTable(quote.line_items);
  renderReconcileTable(rows);
  runBtn.disabled = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function init() {
  const res = await fetch("./fixtures.json");
  fixtures = await res.json();
  const keys = Object.keys(fixtures);
  sampleSelect.innerHTML = keys
    .map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(fixtures[key].label)}</option>`)
    .join("");

  // Prefer noisy OCR so visitors see a review flag immediately after one click.
  const noisy = keys.find((k) => k.includes("noisy"));
  if (noisy) sampleSelect.value = noisy;

  loadSampleIntoEditor();

  sampleSelect.addEventListener("change", () => {
    if (!customToggle.checked) loadSampleIntoEditor();
  });
  customToggle.addEventListener("change", () => setCustomMode(customToggle.checked));
  runBtn.addEventListener("click", () => {
    runDemo().catch((err) => {
      console.error(err);
      runBtn.disabled = false;
      stageStatus.hidden = true;
  stageStatus.classList.add('is-done');
      results.hidden = false;
      resultsBody.hidden = true;
      resultsSummary.textContent = "Demo failed to run. Check the browser console.";
    });
  });
  resetBtn.addEventListener("click", () => {
    customToggle.checked = false;
    setCustomMode(false);
    results.hidden = true;
    loadSampleIntoEditor();
  });

  if (new URLSearchParams(window.location.search).has("run")) {
    await runDemo();
  }
}

init().catch((err) => {
  console.error(err);
  invoiceText.value = "Failed to load demo fixtures. Refresh the page or open via a local static server.";
});
