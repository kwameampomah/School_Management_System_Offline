# System Invariants & Rules

## 1. React Query & useEffect Primitive Dependency Invariants
* **Invariant**: Always memoize React Query input parameters with `useMemo` and use primitive string keys (e.g. `students?.map(s => s.id).join(",")`) for `useEffect` dependency arrays to prevent infinite re-fetching and UI freezing.

## 2. Print Immunity Invariant for Document & Report Generators
* **Invariant**: Use pure HTML `<table>` elements with explicit inline CSS styles (`style={{ border: "1px solid #000000", borderCollapse: "collapse" }}`) for all multi-column document layouts to guarantee 100% pixel-perfect screen-to-paper parity across browser print engines (`window.print()` and `html2pdf.js`).

## 3. Math Rounding & Whole Number Invariants for GES Grading
* **Invariant**: Apply explicit integer rounding (`Math.round`) at each score component level (Class Work 50%, Exam 50%, Subject Total 100%) and sum pre-rounded values for total learner scores.
