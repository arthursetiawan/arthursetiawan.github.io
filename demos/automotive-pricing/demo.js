(() => {
  const TIER_MAX_DISCOUNT = { platinum: 0.4, gold: 0.3, silver: 0.2, bronze: 0.1 };
  const CATEGORY_BIAS = {
    brake: 0.02,
    engine: -0.01,
    electrical: 0.01,
    body: 0,
    suspension: 0.015,
    transmission: -0.02,
    filter: 0.03,
    hvac: 0.005,
  };
  const TARGET_MARGIN = 0.15;

  const form = document.getElementById("pricing-form");
  const errorEl = document.getElementById("form-error");
  const resultsEl = document.getElementById("results");
  const discountEl = document.getElementById("discount_pct");
  const discountLabel = document.getElementById("discount-label");
  const tariffEl = document.getElementById("tariff_rate");
  const tariffLabel = document.getElementById("tariff-label");
  const year = document.getElementById("year");

  if (year) year.textContent = String(new Date().getFullYear());

  function pct(n) {
    return `${(n * 100).toFixed(0)}%`;
  }

  function money(n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  }

  function syncLabels() {
    discountLabel.textContent = pct(Number(discountEl.value));
    tariffLabel.textContent = pct(Number(tariffEl.value));
  }

  discountEl.addEventListener("input", syncLabels);
  tariffEl.addEventListener("input", syncLabels);
  syncLabels();

  function readQuote() {
    return {
      part_category: document.getElementById("part_category").value,
      dealer_tier: document.getElementById("dealer_tier").value,
      base_cost: Number(document.getElementById("base_cost").value),
      list_price: Number(document.getElementById("list_price").value),
      requested_discount: Number(discountEl.value),
      tariff_rate: Number(tariffEl.value),
      target_margin: TARGET_MARGIN,
    };
  }

  function validate(q) {
    if (q.base_cost < 0) return "Base cost must be ≥ 0.";
    if (q.list_price <= 0 || q.list_price < q.base_cost) return "List price must be ≥ base cost.";
    const maxD = TIER_MAX_DISCOUNT[q.dealer_tier];
    if (q.requested_discount > maxD + 1e-9) {
      return `Discount exceeds ${pct(maxD)} cap for ${q.dealer_tier} tier.`;
    }
    return null;
  }

  function mockWinProbability(q) {
    const tariffCost = q.base_cost * (1 + q.tariff_rate);
    const selling = q.list_price * (1 - q.requested_discount);
    const margin = selling <= 0 ? 0 : (selling - tariffCost) / selling;
    const tierBoost = { platinum: 0.08, gold: 0.05, silver: 0.02, bronze: 0 }[q.dealer_tier] || 0;
    const raw =
      0.42 +
      0.55 * q.requested_discount +
      tierBoost +
      (CATEGORY_BIAS[q.part_category] || 0) -
      0.35 * Math.max(0, margin - 0.2) -
      0.15 * q.tariff_rate;
    return Math.min(0.97, Math.max(0.04, raw));
  }

  function recommendPrice(q, winP) {
    const discounted = q.list_price * (1 - q.requested_discount);
    const tariffCost = q.base_cost * (1 + q.tariff_rate);
    const blend = 0.35 + 0.5 * winP;
    let raw = blend * q.list_price + (1 - blend) * discounted;
    return Math.max(raw, tariffCost);
  }

  function optimize(q, winP, raw) {
    const tariffAdjustedCost = q.base_cost * (1 + q.tariff_rate);
    let marginFloor = tariffAdjustedCost / (1 - q.target_margin);
    let tariffCeiling = q.list_price * (1 + 0.25 * q.tariff_rate);
    if (marginFloor > tariffCeiling) tariffCeiling = marginFloor;
    const clamped = Math.max(marginFloor, Math.min(tariffCeiling, raw));
    let note;
    let cls = "";
    if (raw < marginFloor) {
      cls = "";
      note = `Raw ${money(raw)} was below the margin floor ${money(marginFloor)} (target margin ${pct(q.target_margin)} on tariff-adjusted cost). Price clamped up.`;
    } else if (raw > tariffCeiling) {
      cls = "is-ceiling";
      note = `Raw ${money(raw)} exceeded the tariff ceiling ${money(tariffCeiling)}. Price clamped down to stay inside the feasible band.`;
    } else {
      note = `Raw ${money(raw)} already falls between floor and ceiling — clamp is a no-op.`;
    }
    return { marginFloor, tariffCeiling, clamped, note, cls };
  }

  function render(q, winP, raw, opt) {
    resultsEl.innerHTML = `
      <div class="metric-row">
        <div class="metric">
          <span class="label">Win probability</span>
          <span class="value accent">${(winP * 100).toFixed(1)}%</span>
        </div>
        <div class="metric">
          <span class="label">Recommended price</span>
          <span class="value">${money(raw)}</span>
        </div>
        <div class="metric">
          <span class="label">Clamped price</span>
          <span class="value accent">${money(opt.clamped)}</span>
        </div>
      </div>
      <p class="clamp-note ${opt.cls}">${opt.note}</p>
      <p class="panel-note" style="margin-top:0.85rem">
        Margin floor ${money(opt.marginFloor)} · Tariff ceiling ${money(opt.tariffCeiling)} · Synthetic elasticity model (browser only).
      </p>
    `;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = readQuote();
    const err = validate(q);
    if (err) {
      errorEl.hidden = false;
      errorEl.textContent = err;
      return;
    }
    errorEl.hidden = true;
    const winP = mockWinProbability(q);
    const raw = recommendPrice(q, winP);
    const opt = optimize(q, winP, raw);
    render(q, winP, raw, opt);
  });
})();
