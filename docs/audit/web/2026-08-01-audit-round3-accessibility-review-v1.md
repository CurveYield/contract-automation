# Audit Web Round 3 Accessibility Review v1

## Target

The release candidate targets WCAG 2.2 AA for the execution-disabled audit reporting and operator surface.

## Executed static checks

- A single `main` landmark is labeled by one page-level `h1`.
- The skip link targets the focusable main region.
- Primary navigation has an accessible name and current-page state.
- Loading, unauthorized, not-found and offline-stale states use bounded status or alert semantics.
- Persisted diagnostics are not each marked as urgent alerts; one polite status announces the count.
- Tables have captions, column headers, row headers and bounded horizontal overflow containers.
- Copy-safe identifiers are keyboard focusable and wrap at narrow widths.
- Details/summary controls retain native keyboard behavior and accessible names.
- Visible focus uses a dedicated system-color token.
- Reduced-motion CSS removes smooth scrolling and minimizes animation/transition duration.
- Forced-colors CSS preserves borders, focus, badges and system colors.
- Mobile, tablet, desktop, 320 CSS-pixel narrow width, 200% zoom and 400% zoom layout contracts are represented in deterministic tests.
- Long identifiers, huge counts, bidi controls, partial records and large report-graph payloads are bounded before rendering.

## Contrast documentation

The stylesheet uses CSS system colors (`Canvas`, `CanvasText`, `LinkText`, `Highlight`) so user-agent light, dark and forced-color themes retain platform-defined contrast. Borders use current text color. No information relies on color alone; status text remains present.

## Browser-only checks not executed

No browser, assistive-technology runtime or screenshot dependency was introduced. The following checks remain for Round 4 manual acceptance and must not be treated as executed here:

- NVDA + Firefox screen reader reading order and announcement timing;
- VoiceOver + Safari landmark, table and details navigation;
- Windows High Contrast visual inspection;
- browser zoom inspection at 200% and 400%;
- keyboard-only tab order across a deployed static build;
- real-device touch target and viewport inspection;
- automated browser accessibility-tree scan and contrast measurement.

## Manual screen reader script

1. Open each top-level route and use landmark navigation to reach `main`.
2. Confirm the page `h1` is announced once.
3. Navigate tables by row/column header and verify captions identify the dataset.
4. Trigger a route refresh and confirm loading is announced politely, followed by the final state.
5. Load unauthorized and offline-stale fixtures and confirm the state is distinguishable without visual context.
6. Navigate diagnostic cards and confirm historical items are not all announced as urgent alerts.
7. Expand and collapse details using Enter and Space.
8. Confirm every linked report, profile, parser and result has a meaningful accessible name.
