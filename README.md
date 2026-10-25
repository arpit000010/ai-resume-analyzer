# AI Resume Analyzer 2.0

A local resume-to-job-description analyzer with a dark React dashboard, an Express PDF gateway, and a CPU-only FastAPI semantic engine. Keyword coverage, explicit skill evidence, and contextual similarity remain separate. No paid APIs, API keys, LLM, database, OCR, authentication, or cloud deployment.

## Repository

```text
client/                      React + Vite + Tailwind
  src/
    pages/                   Analyzer page composition
    components/              Layout, forms, analysis dashboard and disclosures
    hooks/                   Request and form state
    services/                HTTP requests
    utils/                   Input validation and result presentation rules
    config/                  Browser API configuration
    lib/                     Compatible Sprint 1/2 imports
  test/                      API and rendered result-state tests
server/                      Express application
  config/                    Listener, CORS and NLP connection configuration
  routes/                    HTTP route wiring
  controllers/               Request lifecycle and cancellation
  validators/                Multipart inputs and Python response contract
  middleware/                Uploads, capacity guard and JSON errors
  services/                  PDF/keyword/semantic orchestration
  utils/                     PDF extraction, text geometry and keyword matching
  test/                      Real HTTP/PDF and deterministic NLP integration tests
nlp/                         FastAPI service
  api/                       Endpoints, body limits and safe errors
  schemas.py                 Validated request and response models
  models/                    Load/warm the CPU model once per process
  processing/                Resume passages, JD extraction and shared skill matching
  matching/                  Cosine retrieval and hybrid evidence decisions
  config.py                  Model identity, limits and environment settings
  tests/                     Deterministic quality/API tests and optional model test
shared/                      Canonical skills/aliases and browser/server input limits
scripts/                     Offline end-to-end and optional Chrome browser checks
docs/architecture.md         Data flow, rules, compatibility and future containers
```

Each app has its own dependency environment. The monorepo intentionally does not introduce a workspace manager or shared build framework. Existing `nlp.app:app`, `nlp.engine`, `nlp.model`, `client/src/lib/analyzer.js`, and `client/src/SemanticResults.jsx` entrypoints remain compatible.

## Local setup

Use **Node 22.9+** (Node 24 recommended) and **Python 3.11 or 3.12**. Start commands below run in separate terminals. Never put secrets in browser `VITE_*` variables.

```sh
# Terminal 1 — from repository root
python3.11 -m venv nlp/.venv
source nlp/.venv/bin/activate
python -m pip install -r nlp/requirements-test.txt
python -m nlp.download_model
python -m uvicorn nlp.app:app --host 127.0.0.1 --port 8000 --workers 1 --no-access-log
```

```sh
# Terminal 2 — from repository root
cd server
npm ci
# For a new checkout only; keep any existing .env.
cp -n .env.example .env
npm run dev
```

```sh
# Terminal 3 — from repository root
cd client
npm ci
cp -n .env.example .env
npm run dev
```

Open **http://localhost:5173**. Upload a text-based PDF (maximum 5 MiB), paste the JD (20–20,000 characters), and analyze. Express runs at `http://127.0.0.1:5000`; Vite proxies `/api`. `npm start` in `server/` runs without file watching.

The download command fetches the pinned public [all-MiniLM-L6-v2 model](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) once, into ignored `.models/` (approximately 87 MB). Plan for roughly 1–2 GB including the Python/PyTorch environment. Loading and inference are forced to CPU. Startup defaults to cache-only, uses safetensors with remote code disabled, warms the model once, and reuses it. No resume text is sent to Hugging Face. One Uvicorn worker avoids multiple model copies; the default is two CPU threads and batches of 16 passages. Model downloads need internet; subsequent analysis works offline.

## Configuration

| Component | Variables | Behavior |
| --- | --- | --- |
| Express | `HOST`, `PORT`, `CLIENT_ORIGINS` | Loopback, 5000, and `http://localhost:5173` by default; origins are comma-separated |
| Express → Python | `NLP_SERVICE_URL`, `NLP_TIMEOUT_MS`, `NLP_ENABLED` | `http://127.0.0.1:8000`, 8000 ms (maximum 15000), and enabled; `false` disables semantic calls |
| React/Vite | `VITE_API_BASE_URL`, `API_PROXY_TARGET` | Empty API URL uses the development `/api` proxy; proxy target defaults to Express on 5000 |
| Python | `NLP_MODEL_CACHE`, `NLP_MODEL_REVISION`, `NLP_CPU_THREADS`, `NLP_ALLOW_DOWNLOAD` | `.models`, pinned revision, 2 threads (1–8), and no startup download |

Examples live in each app's `.env.example`. Express and Vite read their own `.env`; **Python does not automatically load it**. Export Python variables before starting the service, using the same cache/revision when downloading and serving. Restart services after configuration changes. The default model revision is `1110a243fdf4706b3f48f1d95db1a4f5529b4d41`.

For client production preview, build with `VITE_API_BASE_URL=http://127.0.0.1:5000`, allow `http://localhost:4173` in Express `CLIENT_ORIGINS`, restart Express, then run `npm run preview -- --host localhost` in `client/`. The development proxy is not included in the production bundle. No hosting/deployment is configured.

## What the analysis means

1. **PDF normalization:** positional text reconstruction adds spaces between separate words and keeps line, bullet, section, paragraph and page boundaries where available. Ligatures, zero-width characters, and common hyphenated line wraps are normalized. A page extraction failure rejects the PDF rather than silently returning partial text.
2. **JD requirements:** inspectable rules identify qualification/responsibility sections and requirement language. Markdown/Setext headings, role/team titles, employment metadata, standalone fragments such as `must.`, company descriptions, benefits, and generic filler are excluded. Meaningful unknown or incomplete qualification items are retained with visible extraction uncertainty. Duplicate items are merged, and conflicting priority labels are flagged. Explicit wording and recognized headings determine required, preferred, optional, responsibility, or unspecified priority; generic “Qualifications” or “Additional skills” alone does not make a condition mandatory. Requirements are grouped into technical, experience, education, and other categories. No requirements recognized means an explicit empty state, not invented comparisons.
3. **Keyword baseline:** the original full-JD score remains `round(matched unique skills / recognized unique JD skills × 100)`, with `null` if no catalog skills are recognized. Both runtimes consume **`shared/skills.json`**. Alias and token-boundary rules distinguish C, C++, C#, Java/JavaScript, and Git/GitHub. SQL dialects currently canonicalize to SQL. This literal coverage can include company-context, optional, or negated mentions; it is not a filtered mandatory-skill score or proficiency measure.
4. **Hybrid evidence:** each extracted requirement retrieves contextual resume passages with the unchanged MiniLM model and normalized cosine similarity. Affirmative exact/alias skill evidence is retained even if semantic similarity is weak. Relevant skill-bearing passages take precedence over semantically similar but unrelated text. Individual skill passages remain available, including when evidence spans multiple resume bullets. Resume section labels are preserved as metadata. Contact-only text and hobby sections are excluded; unrelated nearest passages remain flagged `relevant: false` in the compatible API but are hidden from supporting-evidence views. Skill and topical indexes are computed once per request rather than rescanning the entire resume for every requirement.
5. **Final evidence classifications:** `evidenceKind` is the human-facing source of truth: `explicit` (a direct self-reported skill or normalized degree/field mention), `contextual` (partial/contextual evidence), `uncertain` (ambiguous, negated, incomplete or unverified conditions), or `not_evidenced` (no sufficiently relevant evidence found). It does **not** establish proficiency, verified qualifications, or eligibility. Legacy `hybridStatus` remains additive-compatible: explicit → supported, contextual/uncertain → uncertain, not_evidenced → missing. Raw cosine/strong/possible/weak retrieval signals never determine overview counts on their own.
6. **Alternatives and education:** skill conditions are AND between groups, OR within each group. Python OR Perl is satisfied by an affirmative Python or Perl mention; unused alternatives are not missing obligations or recommended gaps. Comma-OR lists and repeated AND conditions are retained. B.Tech CSE and B.Tech Computer Science normalize to the same engineering-degree/field mention; this does not verify completion/accreditation or automatically equate B.Sc to B.Tech. More complex nested conditions, cross-degree equivalence, experience substitutions, and employer-specific eligibility still require review.

The dashboard uses centralized background/surface/blue-accent/status tokens and a compact workspace layout. It surfaces prioritized improvements, the actual requirement total plus four final evidence counts, full-JD keyword coverage, and named skill gaps. Requirements are grouped by final evidence status, then ordered by required/preferred/optional context, with category labels on each row. Groups are collapsed by default. Evidence, uncertainty, and raw cosine details are expandable. There is **no overall hybrid percentage**, fabricated analytics, or 47-card comparison wall. Required gaps take priority over preferred gaps. Both the public `suggestions` field and the dashboard recommendations use extracted requirements; optional, company-context, metadata, and satisfied alternatives do not become improvement gaps. Suggestions never recommend claiming unearned skills. Replacement inputs invalidate stale results without a page reload, and failures preserve inputs with an explicit retry action. Error, empty, loading, no-requirement, and Python-unavailable states preserve a useful workflow.

## API and resource limits

- `GET /api/health`: Express liveness.
- `GET /api/health/semantic`: Python readiness via Express; 503 on unavailable dependency.
- `GET /health/live` and `/health/ready` on Python; readiness requires a loaded, warmed model.
- `POST /api/analyze`: multipart `resume` (one PDF) and `jobDescription` (one text field).
- `POST /match` on Python: JSON `resumeText` and `jobDescription`. Open `/docs` on port 8000 for typed schemas.

```sh
curl http://127.0.0.1:5000/api/analyze \
  -F 'resume=@/absolute/path/resume.pdf;type=application/pdf' \
  --form-string 'jobDescription=Required: Programming experience with C/C++ and Linux.'
```

All existing keyword fields are preserved: `resumeSkills`, `jobSkills`, `matchedSkills`, `missingSkills`, `baselinePercentage`, `scoring`, and `suggestions`. The additive `semantic` object retains raw `similarity`, legacy retrieval `status` (`strong`, `possible`, `weak`), and `evidence`. New fields include `analysisVersion: "hybrid-requirements-v2"`, `category`, `priority`, `hybridStatus`, `basis`, `matchedSkills`, `missingSkills`, `skillEvidence`, and `uncertainty`. Final-pass additions are `evidenceKind`, `sourceSection`, `extractionConfidence`, `alternativeSkills`, `skillConditions`, and `evidence.section` / `evidence.relevant`. Express validates classification consistency and OR-condition missing sets before forwarding results. Legacy semantic responses still render, conservatively labelled for review. The raw thresholds remain 0.65/0.40; these are uncalibrated retrieval heuristics, not probabilities, percentages, or verified qualifications.

Python accepts 60,000 resume characters, 20,000 JD characters, 160 resume passages and 80 extracted requirements, with a 1,000,000-byte body cap. Passage limits reject rather than silently truncate. Token-aware splitting respects the model's 256-token window, including special tokens. Express allows two concurrent uploads/analyses, uses a ten-second PDF worker deadline and V8 heap limit, and validates upload MIME/extension/signature. Python runs one inference at a time and returns 503 if busy. Resumes stay in memory; no uploaded files, embeddings or user analyses are persisted or logged. Test fixtures and previews are separate from user processing.

Validation errors are structured JSON with `error.code` and `error.message`. Express responds with 400 for bad fields, 413 for file size, 415 for file type/signature, and 422 for damaged, encrypted or unreadable PDFs. Python failures, limits, timeouts, and malformed responses preserve the independent keyword result and show a clear fallback. Express cancellation stops the outgoing request; Python CPU work already running may finish before releasing its inference lock. There are no automatic retries or unbounded inference queues.

## Verification

```sh
# Repository root; deterministic Python tests do not need model weights
nlp/.venv/bin/python -m unittest discover -s nlp/tests -v
# Include the cached real model, with Hub access disabled
HF_HUB_OFFLINE=1 NLP_RUN_MODEL_TESTS=true nlp/.venv/bin/python -m unittest discover -s nlp/tests -v
# Real generated PDF -> production Express listener -> FastAPI -> cached CPU model
nlp/.venv/bin/python scripts/smoke_local.py
```

```sh
cd server
npm test
npm run build
```

```sh
cd client
npm test
npm run lint
npm run build
```

Server build runs Node syntax checks (no compilation needed). Tests cover PDF geometry and actual segmented PDFs, alias boundaries, full-JD keyword scores, heading/fragment filtering, required/preferred labels, categorization, C/C++ evidence despite low similarity, irrelevant/negated/aspirational evidence, API limits, timeout/fallback/cancellation, model reuse, and frontend empty/error/loading/fallback/results states. Client result rendering reuses the existing Vite/esbuild toolchain and React's server renderer, without a new test framework.

Optional real-browser flow, using an already installed Chrome (set the executable path appropriate to your OS):

```sh
SMOKE_BROWSER=true CHROME_BIN=/path/to/chrome \
  SMOKE_SCREENSHOT_DIR=/tmp/resumelens-preview \
  nlp/.venv/bin/python scripts/smoke_local.py
```

This starts temporary FastAPI/Express/Vite listeners and a separate headless Chrome profile, uploads a generated systems-resume PDF through React, checks real result/summary counts, loading/disabled feedback, keyboard evidence and optional similarity expansion, replacement resume/JD analysis, network failure/retry, actual malformed-PDF failure/retry, mobile reanalysis, and desktop/mobile overflow, optionally saves screenshots, then stops the services. It needs permission to bind loopback ports and launch Chrome in restricted environments. No browser package is installed.

Final local acceptance: **34 Node tests**, **13 client tests**, and **36 Python tests including two cached-model checks**. Run the commands above to reproduce. Client lint/production build, server syntax checks, dependency consistency, and local browser acceptance are part of the release check. The representative systems fixture produces five actual requirements, retaining 75% literal keyword coverage; browser counts are asserted against the final backend classifications. A replacement Markdown JD plus B.Tech CSE/Python resume produces two direct self-reported mentions, satisfies Python OR Perl without a false Perl gap, and keeps 50% literal keyword coverage separate. Browser scenarios include upload, input entry, loading, native keyboard disclosures, evidence/similarity expansion, replacement/reanalysis, network failure/retry, malformed PDF/retry, and 1440px/390px layouts. Screenshots are saved only when explicitly requested for generated test fixtures. The exact original user-observed JD/resume was not attached; these are regression fixtures, not a claim of universal extraction accuracy. Browserslist emits a non-blocking data-age warning.

## Limitations and Docker readiness

PDF reading order is best effort: columns, complex tables, broken font maps, missing spaces in source data, and discretionary hyphens can remain ambiguous. Image-only documents need OCR, which is excluded. The rule-based JD extractor can still misread unusual heading scope, nested/implicit alternatives, malformed source text, or requirements expressed outside recognizable sections; required/preferred labels and all evidence should be checked against the source. The taxonomy is finite, the model is primarily English, and local negation rules are conservative rather than a full language understanding system. Similarity thresholds are uncalibrated. Skills mentioned only in a skills list do not prove hands-on experience; academic credentials, durations, and proficiency are not automatically verified.

The repo has independent app boundaries, environment-based service connections, readiness/liveness checks, a single shared taxonomy, dependency manifests, and an ignored model cache, so a later containerization step has clear entrypoints. It will still need Dockerfiles/build contexts (including `shared/`), service DNS/bind settings, model cache provisioning, and OS-level resource limits. **No Docker, AWS, authentication, database, OCR, or deployment was added.** This remains a locally operated product, not an exposed multi-user service.
