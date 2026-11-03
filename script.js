(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const revealTargets = document.querySelectorAll(
    ".section-head, .lifecycle, .role-map article, .impact-strip, .feature, .rail-item, .stack-grid > div, .timeline li, .contact-row, .langs"
  );
  revealTargets.forEach((el) => el.classList.add("reveal"));

  if (!("IntersectionObserver" in window)) {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -6% 0px" }
  );

  revealTargets.forEach((el) => observer.observe(el));
})();
