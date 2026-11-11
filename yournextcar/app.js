(() => {
  // Sample inventory mirrored from vehicle-negotiator-engine web/static_mock
  const SAMPLE = [
    {
      title: "2025 Toyota Camry SE — Toyota of San Francisco",
      url: "https://www.cars.com/vehicledetail/sample-camry-se-sf/",
      price: 36490,
      dealer: "Toyota of San Francisco",
      days: 18,
      stock: "T25-1842",
      score: 11.5,
    },
    {
      title: "2025 Toyota Camry SE FWD — City Toyota",
      url: "https://www.autotrader.com/cars-for-sale/sample-camry-city/",
      price: 35980,
      dealer: "City Toyota",
      days: 41,
      stock: "CT-90211",
      score: 12.2,
    },
    {
      title: "New 2025 Camry SE — Maguire Toyota of Berkeley",
      url: "https://www.cargurus.com/Cars/sample-camry-berkeley",
      price: 37250,
      dealer: "Maguire Toyota of Berkeley",
      days: 9,
      stock: "MB-5510",
      score: 10.1,
    },
  ];

  const DOC_CAPS = { CA: 85, WA: 200, TX: 150 };

  const state = {
    step: 0,
    selected: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const footerYear = $("#footer-year");
  if (footerYear) footerYear.textContent = String(new Date().getFullYear());

  function showStep(n) {
    state.step = n;
    $$(".panel").forEach((panel) => {
      const active = Number(panel.dataset.panel) === n;
      panel.hidden = !active;
      panel.classList.toggle("is-hidden", !active);
    });
    $$(".step").forEach((btn) => {
      const idx = Number(btn.dataset.step);
      btn.classList.toggle("is-active", idx === n);
      btn.classList.toggle("is-done", idx < n);
      if (idx === n) btn.setAttribute("aria-current", "step");
      else btn.removeAttribute("aria-current");
    });
    if (n === 2) renderListings();
    if (n === 3) renderNegotiate();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formValues() {
    return {
      zip: $("#zip").value.trim() || "94107",
      state: $("#state").value,
      anyFranchise: $("#anyFranchise").checked,
      dealer: $("#dealer").value.trim(),
      year: $("#year").value,
      make: $("#make").value.trim() || "Toyota",
      model: $("#model").value.trim() || "Camry",
      trim: $("#trim").value.trim(),
      condition: $("#condition").value,
      budget: Number($("#budget").value) || 0,
      musts: $("#musts").value.trim(),
    };
  }

  function renderListings() {
    const v = formValues();
    const dealerBit = v.anyFranchise ? "dealer inventory" : v.dealer || "dealer inventory";
    $("#searchQuery").textContent =
      `Query: ${v.condition} ${v.year} ${v.make} ${v.model} ${v.trim} for sale ${dealerBit} near ${v.zip}`.replace(
        /\s+/g,
        " "
      );

    const root = $("#listings");
    root.innerHTML = "";
    SAMPLE.forEach((item, idx) => {
      const overBudget = v.budget > 0 && item.price > v.budget;
      const el = document.createElement("article");
      el.className = "listing";
      el.style.animationDelay = `${idx * 80}ms`;
      el.innerHTML = `
        <span class="badge">Mock demo</span>
        <strong>${item.title}</strong>
        <div class="meta">$${item.price.toLocaleString()} · ${item.dealer} · ${item.days}d on market · score ${item.score}${
          overBudget ? " · over OTD ceiling" : ""
        }</div>
        <a href="${item.url}" target="_blank" rel="noopener">Open listing (sample URL)</a>
      `;
      const pick = document.createElement("button");
      pick.type = "button";
      pick.textContent = `Pick this target #${idx + 1}`;
      pick.addEventListener("click", () => {
        state.selected = item;
        showStep(3);
      });
      el.appendChild(pick);
      root.appendChild(el);
    });
  }

  function junkTips(make, stateCode) {
    const tips = [
      `${make} often carries a Market Adjustment / ADM on constrained trims — strike it from the Buyer's Order.`,
    ];
    if (DOC_CAPS[stateCode] != null) {
      tips.push(
        `${stateCode} documentation fee statutory ceiling is $${DOC_CAPS[stateCode]}. Anything above is a junk-fee strike.`
      );
    } else {
      tips.push(
        `${stateCode} has no hard doc-fee cap here — flag anything above $399 as Excessive / High-Negotiation Target.`
      );
    }
    tips.push(
      "Ask for a signed Buyer's Order Out-The-Door before any showroom visit — payment packing usually appears after you sit down."
    );
    tips.push(
      "Common removable add-ons: paint/ceramic packages, nitrogen, etch, LoJack, PDI/dealer prep."
    );
    return tips;
  }

  function coldScript(item, v) {
    const vehicle = `${v.year} ${v.make} ${v.model} ${v.trim}`.trim();
    const probe = Math.round(item.price * 0.97);
    const target =
      v.budget > 0
        ? `I am prepared to proceed at an Out-The-Door maximum of $${v.budget.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}.`
        : `Your listing shows approximately $${item.price.toLocaleString()}. I am prepared to move today at an Out-The-Door figure of $${probe.toLocaleString()}.`;

    const mustLine = v.musts ? `Must-haves noted: ${v.musts}.\n\n` : "";

    return (
      `Subject: Remote purchase inquiry — ${vehicle} near ${v.zip}\n\n` +
      `Hello ${item.dealer},\n\n` +
      `I am interested in stock #${item.stock} (${vehicle}) and would like to complete this purchase remotely.\n\n` +
      `${mustLine}` +
      `${target}\n\n` +
      `Please reply with a signed Buyer's Order matching that Out-The-Door figure. ` +
      `I can place an electronic deposit and remote credit application once figures are locked. ` +
      `I will not visit the showroom before the OTD is confirmed in writing.\n\n` +
      `Listing for reference: ${item.url}\n\n` +
      `Please confirm yes/no today so I can either proceed or move to another inventory unit.\n\n` +
      `Regards`
    );
  }

  function renderNegotiate() {
    const v = formValues();
    const item = state.selected;
    const tipsRoot = $("#tips");
    tipsRoot.innerHTML = "";

    if (!item) {
      $("#targetSummary").textContent = "Pick a listing in Find to generate a targeted script.";
      $("#script").textContent = "";
      $("#otdDraft").textContent = "";
      return;
    }

    $("#targetSummary").textContent =
      `Target: ${item.title} · $${item.price.toLocaleString()} · ${item.dealer}`;

    junkTips(v.make, v.state).forEach((tip) => {
      const div = document.createElement("div");
      div.className = "tip";
      div.textContent = tip;
      tipsRoot.appendChild(div);
    });

    $("#script").textContent = coldScript(item, v);
    const otd =
      v.budget > 0
        ? `Out-The-Door $${v.budget.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : "a complete Out-The-Door Buyer's Order";
    const cap = DOC_CAPS[v.state];
    const docBit =
      cap != null ? `approved doc fee (≤ $${cap} in ${v.state})` : "approved doc fee only";
    $("#otdDraft").textContent =
      `Subject: Request — signed Buyer's Order for ${v.year} ${v.make} ${v.model}\n\n` +
      `Please send a signed Buyer's Order for ${item.stock} reflecting ${otd}. ` +
      `Tax/title/license + ${docBit} — no ADM or protection products. Ready to e-deposit on receipt.`;
  }

  async function copyText(el, btn) {
    try {
      await navigator.clipboard.writeText(el.textContent);
      const prev = btn.textContent;
      btn.textContent = "Copied";
      window.setTimeout(() => {
        btn.textContent = prev;
      }, 1500);
    } catch {
      btn.textContent = "Select & copy";
    }
  }

  $("#anyFranchise").addEventListener("change", (e) => {
    $("#dealer").disabled = e.target.checked;
  });

  $$("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = Number(btn.dataset.next);
      if (next === 1 && !$("#zip").value.trim()) {
        $("#zip").focus();
        return;
      }
      showStep(next);
    });
  });

  $$(".step").forEach((btn) => {
    btn.addEventListener("click", () => showStep(Number(btn.dataset.step)));
  });

  $("#restart").addEventListener("click", () => {
    state.selected = null;
    showStep(0);
  });

  $("#copy-script").addEventListener("click", () => copyText($("#script"), $("#copy-script")));
  $("#copy-otd").addEventListener("click", () => copyText($("#otdDraft"), $("#copy-otd")));

  showStep(0);
})();
