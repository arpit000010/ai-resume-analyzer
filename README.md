# AI Resume Analyzer 2.0 — Sprint 1

Local React + Express resume-to-job-description matching. No paid APIs, accounts, database, or external inference services are required. This sprint implements a deterministic baseline; it does not use an LLM or semantic NLP.

## Run locally

Use Node.js 22.9+ (Node 24 LTS recommended). From the repository root:

```sh
cd server
npm ci
cp .env.example .env
npm run dev
```

In a second terminal:

```sh
cd client
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173. The Vite development proxy forwards `/api` to http://127.0.0.1:5000. Upload a text-based PDF up to 5 MiB and paste a job description of 20–20,000 characters. All resume processing takes place in the local Express process and its parser worker. Resumes and job descriptions are not persisted or logged.

`server/.env` supports `HOST`, `PORT`, and comma-separated `CLIENT_ORIGINS`. `client/.env` supports `API_PROXY_TARGET` for development and `VITE_API_BASE_URL` for a separate backend origin. Restart after environment changes. Client `VITE_*` values are public and embedded at build time; never put secrets there.

To serve Express without file watching, run `npm start` in `server`. For a built client preview, set `VITE_API_BASE_URL=http://127.0.0.1:5000` before building, include `http://localhost:4173` in server `CLIENT_ORIGINS`, restart Express, then run `npm run build` and `npm run preview -- --host localhost` in `client`. Vite's development proxy is not part of the production bundle. A future deployment must serve `/api` through the same origin or configure the backend URL and allowed origins explicitly.

## API

- `GET /api/health` returns `{ "status": "ok" }`.
- `POST /api/analyze` accepts multipart fields `resume` (one PDF) and `jobDescription` (one text field). The old role dropdown API is replaced.

```sh
curl http://127.0.0.1:5000/api/analyze \
  -F 'resume=@/absolute/path/resume.pdf;type=application/pdf' \
  --form-string 'jobDescription=Seeking a React developer with Node.js and Python experience.'
```

Results include `resumeSkills`, `jobSkills`, `matchedSkills`, `missingSkills`, `baselinePercentage`, transparent `scoring` counts/formula, and rule-based `suggestions`. A React + Node.js resume against React + Node.js + Python returns 67%. Repeated mentions and aliases count only once. A description with no recognized skills returns `null` for the percentage with guidance, rather than a misleading score.

Errors have the shape `{ "success": false, "error": { "code": "...", "message": "..." } }`. Validation failures use 400, oversize uploads 413, invalid file types/signatures 415, corrupt/password-protected/unreadable PDFs or parser timeouts 422, and concurrent capacity exhaustion 503. Retry a busy request after current analyses finish.

## Implementation boundaries

- `shared/skills.json` is the canonical skill and alias catalog for both resume and job text. `shared/constraints.json` shares input limits between browser and server.
- `server/services/matchResume.js` is a pure matching service separated from HTTP and PDF parsing, ready for a later Python NLP adapter without coupling it to upload handling.
- Matching uses Unicode-aware token boundaries, escaped aliases, case normalization, and flexible whitespace. It distinguishes Java from JavaScript, Git from GitHub, and C from C++/C#.
- The percentage is `round(matched unique skills / recognized unique job skills × 100)`. Every recognized skill has equal weight. SQL dialects currently map to SQL. The baseline treats all mentions as skills; it does not interpret negation, optional requirements, seniority, proficiency, or experience. Unknown skills are outside the denominator. This is not an ATS or hiring prediction.
- Multer uses bounded memory storage, checks MIME type and extension, and the controller checks the PDF signature. No temporary resume files are created. Buffers are released after success or failure. Two concurrent uploads/analyses are allowed per process. PDF parsing runs in isolated worker threads with a 10-second deadline, a V8 heap limit, and cancellation on disconnect. These are local resource controls, not an OS sandbox or a substitute for infrastructure limits on a public service.
- Express is exported separately from the listener for testing. It defaults to loopback, uses configurable CORS, JSON errors, request timeouts, and graceful shutdown. Keep `shared/` alongside both apps in any future container build context. Python and Docker are not implemented in Sprint 1.

## Verification

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

The backend has no compilation step; its build command performs Node syntax checks. Tests use Node's built-in runner, real generated PDFs, real multipart HTTP requests, and the actual parser. Coverage includes skill boundaries/aliases, scoring, unsupported skills, upload limits and validation, corrupt/blank PDFs, parser timeout/cancellation, buffer release, CORS, overload/disconnect recovery, client request construction, and network/server errors. HTTP tests require permission to bind a temporary loopback port in restricted environments.

OCR, semantic matching, Python NLP, Docker, authentication, and cloud deployment remain outside Sprint 1. No Sprint 1 blockers are currently known.
