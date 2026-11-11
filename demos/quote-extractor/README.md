# GenAI Unstructured Quote Extractor — mock demo

Static, offline mock of [genai-unstructured-quote-extractor](https://github.com/arthursetiawan/genai-unstructured-quote-extractor) for GitHub Pages.

## Live path

https://arthursetiawan.github.io/demos/quote-extractor/

## What it shows

- Preloaded automotive / freight sample invoices (dealer parts, LTL freight, noisy OCR)
- Extracted line items: `PartNumber`, `Description`, `UnitCost`, `CompetitorPrice`, `Vendor`
- Catalog reconciliation with confidence scores
- Human-review flags when confidence &lt; 0.40 (noisy OCR mystery part)
- Deterministic fallback unit-cost bounds for review rows
- Link out to the real GitHub repository

No API keys required — fixtures were generated from the project’s mock extractor + rapidfuzz reconcile path; custom paste uses the same client-side heuristics against a small synthetic catalog.
