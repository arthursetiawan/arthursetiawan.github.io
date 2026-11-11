(() => {
  const INVENTORY = [
    {
      id: "camry-hybrid",
      name: "Toyota Camry Hybrid XLE",
      body: "sedan",
      price: 34500,
      ev: false,
      blurb: "Efficient daily driver, strong resale, comfortable highway manners.",
      tags: ["Hybrid", "Reliability", "Commute"],
    },
    {
      id: "crv-hybrid",
      name: "Honda CR-V Hybrid Sport",
      body: "suv",
      price: 38200,
      ev: false,
      blurb: "Compact SUV footprint with cargo space and light off-pavement ability.",
      tags: ["SUV", "AWD-ready", "Family"],
    },
    {
      id: "model3",
      name: "Tesla Model 3 Long Range",
      body: "sedan",
      price: 42990,
      ev: true,
      blurb: "EV sedan with strong charging network access and OTA updates.",
      tags: ["EV", "Tech", "Performance"],
    },
    {
      id: "ioniq6",
      name: "Hyundai Ioniq 6 SE",
      body: "sedan",
      price: 37850,
      ev: true,
      blurb: "Sleek EV sedan, competitive range, lower entry than luxury EVs.",
      tags: ["EV", "Efficiency", "Design"],
    },
    {
      id: "forester",
      name: "Subaru Forester Wilderness",
      body: "suv",
      price: 39800,
      ev: false,
      blurb: "Outdoor-ready wagon-SUV with standard AWD for PNW weekends.",
      tags: ["AWD", "Adventure", "Utility"],
    },
    {
      id: "r1s",
      name: "Rivian R1S Adventure",
      body: "suv",
      price: 78000,
      ev: true,
      blurb: "Three-row EV SUV — premium adventure positioning.",
      tags: ["EV", "Off-road", "Premium"],
    },
  ];

  const form = document.getElementById("quiz-form");
  const results = document.getElementById("match-results");
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  function scoreVehicle(car, prefs) {
    let score = 72;
    if (prefs.body === car.body) score += 14;
    if (prefs.body === "any") score += 6;
    if (prefs.ev === "yes" && car.ev) score += 12;
    if (prefs.ev === "no" && !car.ev) score += 8;
    if (prefs.ev === "maybe" && car.ev) score += 5;
    const budgetMid = { economy: 28000, mid: 42000, premium: 65000 }[prefs.budget] || 42000;
    const delta = Math.abs(car.price - budgetMid);
    score += Math.max(0, 18 - delta / 2500);
    if (car.price > budgetMid + 12000) score -= 10;
    return Math.min(99, Math.round(score));
  }

  function money(n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
      n
    );
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const prefs = {
      budget: data.get("budget"),
      body: data.get("body"),
      ev: data.get("ev_interest"),
    };
    const ranked = INVENTORY.map((car) => ({ car, score: scoreVehicle(car, prefs) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    results.innerHTML = ranked
      .map(
        ({ car, score }, i) => `
      <article class="match-card" style="animation-delay:${i * 80}ms">
        <span class="score-pill">Match ${score}%</span>
        <h3>${car.name}</h3>
        <p>${money(car.price)} · ${car.tags.join(" · ")}</p>
        <p style="margin-top:0.45rem">${car.blurb}</p>
      </article>`
      )
      .join("");
  });
})();
