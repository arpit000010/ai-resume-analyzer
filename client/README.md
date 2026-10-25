# ResumeLens frontend

React + Vite + Tailwind dashboard for AI Resume Analyzer 2.0. See the root [README](../README.md) for the three-service setup, environment variables and real end-to-end checks.

- `npm ci` — install existing dependencies.
- `npm run dev` — local Vite server with the configured Express proxy.
- `npm test` — API/validation and rendered result-state tests.
- `npm run lint` — React/JavaScript ESLint checks.
- `npm run build` — production assets in ignored `dist/`.

`src/pages` composes the workflow; `components` renders forms and results; `hooks` owns form/request state; `services` handles HTTP; `utils` validates input and organizes results; `config` resolves the browser API URL. `src/lib/analyzer.js` and `src/SemanticResults.jsx` retain the previous import paths.
