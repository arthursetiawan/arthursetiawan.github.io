(() => {
  const TIER_MAX_DISCOUNT = {
    platinum: 0.4,
    gold: 0.3,
    silver: 0.2,
    bronze: 0.1,
  };

  const CATEGORY_BIAS = {
    brake: 0.02,
    engine: -0.01,
    electrical: 0.01,
    body: 0.0,
    suspension: 0.015,
    transmission: -0.02,
    filter: 0.03,
    hvac: 0.005,
  };

  const PRESETS = {
    balanced: {
      part_category: "engine",
      dealer_tier: "gold",
      base_cost: 400,
      list_price: 520,
      requested_discount: 0.1,
      tariff_rate: 0.05,
      target_margin: 0.15,
    },
    floor: {
      part_category: "brake",
      dealer_tier: "platinum",
      base_cost: 180,
      list_price: 220,
      requested_discount: 0.35,
      tariff_rate: 0.18,
      target_margin: 0.28,
    },
    ceiling: {
      part_category: "filter",
      dealer_tier: "bronze",
      base_cost: 25,
      list_price: 95,
      requested_discount: 0.0,
      tariff_rate: 0.0,
      target_margin: 0.08,
      force_above_ceiling: true,
    },
  };

  const els = {
    form: document.getElementById("quote-form"),
    error: document.getElementById("form-error"),
    year: document.getElementById("year"),
    discountLabel: document.getElementById("discount-pct-label"),
    tariffLabel: document.getElementById("tariff-pct-label"),
    marginLabel: document.getElementById("margin-pct-label"),
    predictBody: document.getElementById("predict-body"),
    optimizeBody: document.getElementById("optimize-body"),
    fields: {
      part_category: document.getElementById("part_category"),
      dealer_tier: document.getElementById("dealer_tier"),
      base_cost: document.getElementById("base_cost"),
      list_price: document.getElementById("list_price"),
      requested_discount: document.getElementById("requested_discount"),
      tariff_rate: document.getElementById("tariff_rate"),
      target_margin: document.getElementById("target_margin"),
    },
  };

  if (els.year) els.year.textContent = String(new Date().getFullYear());

  function pct(n) {
    return `${(n * 100).toFixed(0)}%`;
  }

  function money(n) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n);
  }

  function round(n, digits = 4) {
    const f = 10 ** digits;
    return Math.round(n * f) / f;
  }

  function syncLabels() {
    els.discountLabel.textContent = `(${pct(Number(els.fields.requested_discount.value))})`;
    els.tariffLabel.textContent = `(${pct(Number(els.fields.tariff_rate.value))})`;
    els.marginLabel.textContent = `(${pct(Number(els.fields.target_margin.value))})`;
  }

  function readQuote() {
    return {
      part_category: els.fields.part_category.value,
      dealer_tier: els.fields.dealer_tier.value,
      base_cost: Number(els.fields.base_cost.value),
      list_price: Number(els.fields.list_price.value),
      requested_discount: Number(els.fields.requested_discount.value),
      tariff_rate: Number(els.fields.tariff_rate.value),
      target_margin: Number(els.fields.target_margin.value),
    };
  }

  function validate(quote) {
    if (![quote.base_cost, quote.list_price, quote.requested_discount, quote.tariff_rate, quote.target_margin].every(
      (v) => Number.isFinite(v)
    )) {
      return "All numeric fields must be finite numbers.";
    }
    if (quote.base_cost < 0) return "base_cost must be ≥ 0.";
    if (quote.list_price <= 0) return "list_price must be > 0.";
    if (quote.list_price < quote.base_cost) return "list_price must be ≥ base_cost.";
    if (quote.requested_discount < 0 || quote.requested_discount > 1) {
      return "requested_discount must be in [0, 1].";
    }
    if (quote.tariff_rate < 0 || quote.tariff_rate > 1) return "tariff_rate must be in [0, 1].";
    if (quote.target_margin < 0 || quote.target_margin >= 1) {
      return "target_margin must be in [0, 1).";
    }
    const maxDiscount = TIER_MAX_DISCOUNT[quote.dealer_tier];
    if (quote.requested_discount > maxDiscount + 1e-9) {
      return `requested_discount ${quote.requested_discount.toFixed(2)} exceeds max ${maxDiscount.toFixed(2)} for dealer_tier=${quote.dealer_tier}.`;
    }
    return null;
  }

  /** Synthetic stand-in for the trained classifier — monotonic and interpretable. */
  function mockWinProbability(quote) {
    const tariffCost = quote.base_cost * (1 + quote.tariff_rate);
    const selling = quote.list_price * (1 - quote.requested_discount);
    const margin = selling <= 0 ? 0 : (selling - tariffCost) / selling;
    const tierBoost = { platinum: 0.08, gold: 0.05, silver: 0.02, bronze: 0 }[quote.dealer_tier] || 0;
    const raw =
      0.42 +
      0.55 * quote.requested_discount +
      tierBoost +
      (CATEGORY_BIAS[quote.part_category] || 0) -
      0.35 * Math.max(0, margin - 0.2) -
      0.15 * quote.tariff_rate;
    return Math.min(0.97, Math.max(0.04, raw));
  }

  /** Mirrors models/inference.py recommend_price. */
  function recommendPrice(quote, winProbability) {
    const discounted = quote.list_price * (1 - quote.requested_discount);
    const tariffCost = quote.base_cost * (1 + quote.tariff_rate);
    const blend = 0.35 + 0.5 * winProbability;
    let raw = blend * quote.list_price + (1 - blend) * discounted;
    raw = Math.max(raw, tariffCost);
    // Pedagogical override: the committed FastAPI recommender stays ≤ list, so the
    // tariff-ceiling clamp is rare. Force a above-ceiling raw when a preset asks for it.
    if (quote.force_above_ceiling) {
      const ceiling = quote.list_price * (1 + 0.25 * quote.tariff_rate);
      raw = ceiling * 1.12;
    }
    return raw;
  }

  /** Mirrors guardrails/clamping.py + optimize route band construction. */
  function optimizePrice(quote, winProbability, raw) {
    const tariffAdjustedCost = quote.base_cost * (1 + quote.tariff_rate);
    let marginFloor = tariffAdjustedCost / (1 - quote.target_margin);
    let tariffCeiling = quote.list_price * (1 + 0.25 * quote.tariff_rate);
    let bandExpanded = false;
    if (marginFloor > tariffCeiling) {
      tariffCeiling = marginFloor;
      bandExpanded = true;
    }
    const clamped = Math.max(marginFloor, Math.min(tariffCeiling, raw));
    let reason;
    if (raw < marginFloor) {
      reason = {
        kind: "floor",
        text: `Raw recommendation ${money(raw)} sat below the margin floor ${money(marginFloor)} — clamped up to protect target margin.`,
      };
    } else if (raw > tariffCeiling) {
      reason = {
        kind: "ceiling",
        text: `Raw recommendation ${money(raw)} sat above the tariff ceiling ${money(tariffCeiling)} — clamped down to the feasible band.`,
      };
    } else {
      reason = {
        kind: "pass",
        text: `Raw recommendation ${money(raw)} already sits inside the feasible band — clamp is a no-op.`,
      };
    }
    if (bandExpanded) {
      reason.text += " Feasible band was empty; tariff ceiling was expanded to the margin floor.";
    }
    return { marginFloor, tariffCeiling, clamped, reason, bandExpanded };
  }

  function latencyMs() {
    return round(4 + Math.random() * 12, 2);
  }

  function showError(message) {
    if (!message) {
      els.error.hidden = true;
      els.error.textContent = "";
      return;
    }
    els.error.hidden = false;
    els.error.textContent = message;
  }

  function renderPredict(quote, winProbability, recommendedPrice) {
    const payload = {
      win_probability: round(winProbability, 4),
      recommended_price: round(recommendedPrice, 2),
      latency_ms: latencyMs(),
      model_name: "mock-logistic-blend",
    };

    els.predictBody.innerHTML = `
      <div class="metric-row">
        <div class="metric">
          <span class="label">win_probability</span>
          <span class="value accent">${(payload.win_probability * 100).toFixed(1)}%</span>
        </div>
        <div class="metric">
          <span class="label">recommended_price</span>
          <span class="value">${money(payload.recommended_price)}</span>
        </div>
      </div>
      <div class="win-bar" aria-hidden="true">
        <div class="win-bar-track">
          <div class="win-bar-fill" style="width:${payload.win_probability * 100}%"></div>
        </div>
        <div class="win-bar-meta">
          <span>Low confidence</span>
          <span>${payload.model_name} · ${payload.latency_ms} ms</span>
          <span>High confidence</span>
        </div>
      </div>
      <pre class="json-block">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
    `;
  }

  function renderOptimize(quote, winProbability, raw, opt) {
    const payload = {
      raw_model_recommendation: round(raw, 2),
      margin_floor: round(opt.marginFloor, 2),
      tariff_ceiling: round(opt.tariffCeiling, 2),
      clamped_price: round(opt.clamped, 2),
      win_probability: round(winProbability, 4),
      latency_ms: latencyMs(),
      model_name: "mock-logistic-blend",
    };

    const minP = Math.min(payload.margin_floor, payload.raw_model_recommendation, payload.tariff_ceiling, payload.clamped_price);
    const maxP = Math.max(payload.margin_floor, payload.raw_model_recommendation, payload.tariff_ceiling, payload.clamped_price);
    const span = Math.max(maxP - minP, 1);
    const pad = span * 0.12;
    const lo = minP - pad;
    const hi = maxP + pad;
    const pos = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
    const bandStart = ((payload.margin_floor - lo) / (hi - lo)) * 100;
    const bandEnd = ((payload.tariff_ceiling - lo) / (hi - lo)) * 100;

    els.optimizeBody.innerHTML = `
      <div class="metric-row">
        <div class="metric">
          <span class="label">clamped_price</span>
          <span class="value accent">${money(payload.clamped_price)}</span>
        </div>
        <div class="metric">
          <span class="label">raw_model_recommendation</span>
          <span class="value">${money(payload.raw_model_recommendation)}</span>
        </div>
        <div class="metric">
          <span class="label">margin_floor</span>
          <span class="value">${money(payload.margin_floor)}</span>
        </div>
        <div class="metric">
          <span class="label">tariff_ceiling</span>
          <span class="value">${money(payload.tariff_ceiling)}</span>
        </div>
      </div>
      <div class="clamp-viz" style="--band-start:${bandStart}%; --band-end:${bandEnd}%;">
        <div class="clamp-track" aria-hidden="true">
          <span class="clamp-marker clamp-marker--floor" style="left:${pos(payload.margin_floor)}"></span>
          <span class="clamp-marker clamp-marker--ceiling" style="left:${pos(payload.tariff_ceiling)}"></span>
          <span class="clamp-marker clamp-marker--raw" style="left:${pos(payload.raw_model_recommendation)}"></span>
          <span class="clamp-marker clamp-marker--clamped" style="left:${pos(payload.clamped_price)}"></span>
        </div>
        <div class="clamp-legend">
          <span class="leg-floor">margin floor</span>
          <span class="leg-ceiling">tariff ceiling</span>
          <span class="leg-raw">raw recommendation</span>
          <span class="leg-clamped">clamped price</span>
        </div>
      </div>
      <p class="clamp-reason ${opt.reason.kind === "pass" ? "is-pass" : ""}">${escapeHtml(opt.reason.text)}</p>
      <pre class="json-block">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function run(mode) {
    const quote = readQuote();
    quote.force_above_ceiling = activeForceAboveCeiling;
    const error = validate(quote);
    if (error) {
      showError(error);
      return;
    }
    showError(null);

    const winProbability = mockWinProbability(quote);
    const raw = recommendPrice(quote, winProbability);

    if (mode === "predict" || mode === "both") {
      renderPredict(quote, winProbability, raw);
    }
    if (mode === "optimize" || mode === "both") {
      const opt = optimizePrice(quote, winProbability, raw);
      renderOptimize(quote, winProbability, raw, opt);
    }
  }

  let activeForceAboveCeiling = false;

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    activeForceAboveCeiling = Boolean(preset.force_above_ceiling);
    Object.entries(preset).forEach(([key, value]) => {
      if (key === "force_above_ceiling") return;
      if (els.fields[key]) els.fields[key].value = String(value);
    });
    syncLabels();
    showError(null);
    run("both");
  }

  ["requested_discount", "tariff_rate", "target_margin"].forEach((id) => {
    els.fields[id].addEventListener("input", () => {
      activeForceAboveCeiling = false;
      syncLabels();
    });
  });

  ["part_category", "dealer_tier", "base_cost", "list_price"].forEach((id) => {
    els.fields[id].addEventListener("change", () => {
      activeForceAboveCeiling = false;
    });
    els.fields[id].addEventListener("input", () => {
      activeForceAboveCeiling = false;
    });
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    run("both");
  });

  document.getElementById("btn-predict").addEventListener("click", () => run("predict"));
  document.getElementById("btn-optimize").addEventListener("click", () => run("optimize"));

  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => applyPreset(btn.getAttribute("data-preset")));
  });

  syncLabels();
  run("both");
})();
