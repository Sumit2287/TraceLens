# TraceLens

TraceLens is a small JavaScript/Express distributed-tracing dashboard. It records
real requests in memory, exposes Prometheus-compatible metrics, displays trace
timelines, and produces evidence-based incident analysis. Groq is optional: the
local rule engine remains available when no API key is configured.

## Run locally

Requirements: Node.js 18+ and npm. No Docker or external services are required.

```bash
npm install
copy .env.example .env
npm start
```

Open <http://localhost:30001/dashboard>. The port can be changed with `PORT`.

## Configuration

Copy `.env.example` to `.env` and set `GROQ_API_KEY` to a key created in the
Groq console. The key is used only by the backend and must never be placed in
frontend code. `GROQ_MODEL` defaults to `llama-3.1-8b-instant`. Groq failures,
timeouts, and rate limits return the local rule-based analysis instead.

`OTEL_SERVICE_NAME` identifies the service in captured traces. An optional
`OTEL_EXPORTER_JAEGER_ENDPOINT` enables export to an already-running
Jaeger-compatible collector; TraceLens itself does not provision Docker or
external infrastructure.

## Demonstration workflow

1. Start TraceLens and open the dashboard.
2. Visit `/custom` to generate a deliberately slower request.
3. Visit `/health-check` and `/about`, then refresh the dashboard.
4. Inspect individual trace IDs and timings in the trace list.
5. Select **Analyze incident**. The backend checks failed/slow requests, slow
   database spans, retries, and timeouts before optionally sending a bounded,
   structured evidence set to Groq.
6. Use `/api/summary`, `/api/traces`, `/api/traces/:traceId`, and
   `POST /api/analyze-incident` for programmatic access. A request body may
   contain `{ "traceIds": ["..."] }` to limit analysis.

## Tests

```bash
npm test
```

Tests cover existing health/metrics behavior and rule-based detection. Telemetry
is intentionally in memory, so it is cleared when the process restarts and is
not suitable for multi-instance production deployments. Database spans must be
recorded by application code with the exported `addSpan` helper; the sample app
has no database dependency. OpenTelemetry instrumentation is enabled when the
application starts, while the dashboard always has local request telemetry.
