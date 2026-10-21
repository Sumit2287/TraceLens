const MAX_TRACES = 500;
const traces = [];

function createTrace({ req, traceId, serviceName }) {
  const startedAt = Date.now();
  const trace = {
    traceId: traceId || `local-${startedAt}-${Math.random().toString(16).slice(2)}`,
    serviceName,
    method: req.method,
    route: req.path,
    status: 0,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: 0,
    spans: [],
    error: null,
  };
  traces.push(trace);
  if (traces.length > MAX_TRACES) traces.shift();
  return trace;
}

function finishTrace(trace, { status, error } = {}) {
  trace.status = status || 500;
  trace.durationMs = Math.max(0, Date.now() - Date.parse(trace.startedAt));
  if (error) trace.error = String(error.message || error);
  return trace;
}

function addSpan(trace, span) {
  trace.spans.push({
    spanId: span.spanId || `span-${Math.random().toString(16).slice(2)}`,
    name: span.name,
    type: span.type || 'internal',
    durationMs: Math.max(0, Number(span.durationMs) || 0),
    status: span.status || 'ok',
    error: span.error || null,
    startedAt: span.startedAt || new Date().toISOString(),
  });
}

function listTraces({ service, status, from, to, limit = 100 } = {}) {
  const fromTime = from ? Date.parse(from) : 0;
  const toTime = to ? Date.parse(to) : Date.now();
  return traces
    .filter((trace) => {
      const time = Date.parse(trace.startedAt);
      return (!service || trace.serviceName === service)
        && (!status || String(trace.status) === String(status))
        && time >= fromTime && time <= toTime;
    })
    .slice(-Math.min(Math.max(Number(limit) || 100, 1), 100))
    .reverse();
}

function getTrace(traceId) {
  return traces.find((trace) => trace.traceId === traceId) || null;
}

function getSummary() {
  const totalRequests = traces.length;
  const durations = traces.map((trace) => trace.durationMs).sort((a, b) => a - b);
  const errors = traces.filter((trace) => trace.status >= 400).length;
  const statusCodes = traces.reduce((result, trace) => {
    result[trace.status] = (result[trace.status] || 0) + 1;
    return result;
  }, {});
  const percentile = (value) => value.length ? value[Math.min(value.length - 1, Math.ceil(value.length * 0.95) - 1)] : 0;
  return {
    totalRequests,
    errorRate: totalRequests ? Number((errors / totalRequests).toFixed(4)) : 0,
    averageResponseTimeMs: totalRequests ? Math.round(durations.reduce((sum, value) => sum + value, 0) / totalRequests) : 0,
    p95LatencyMs: percentile(durations),
    statusCodes,
    throughputPerMinute: totalRequests,
    services: [...new Set(traces.map((trace) => trace.serviceName))],
  };
}

function reset() {
  traces.length = 0;
}

module.exports = { createTrace, finishTrace, addSpan, listTraces, getTrace, getSummary, reset };
