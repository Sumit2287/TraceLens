function detectFindings(traces) {
  const findings = [];
  traces.forEach((trace) => {
    if (trace.status >= 500) findings.push({ type: 'http-error', severity: 'high', message: `HTTP ${trace.status} on ${trace.method} ${trace.route}`, traceId: trace.traceId });
    if (trace.status >= 400 && trace.status < 500) findings.push({ type: 'client-error', severity: 'medium', message: `HTTP ${trace.status} on ${trace.method} ${trace.route}`, traceId: trace.traceId });
    if (trace.durationMs >= 1000) findings.push({ type: 'slow-request', severity: 'medium', message: `Request took ${trace.durationMs}ms`, traceId: trace.traceId });
    trace.spans.forEach((span) => {
      if (span.type === 'database' && span.durationMs >= 250) findings.push({ type: 'slow-database', severity: 'high', message: `Database span ${span.name} took ${span.durationMs}ms`, traceId: trace.traceId, spanId: span.spanId });
      if (span.type === 'retry' || /retry|timeout/i.test(span.name)) findings.push({ type: 'retry-or-timeout', severity: 'medium', message: `Retry or timeout detected in ${span.name}`, traceId: trace.traceId, spanId: span.spanId });
    });
  });
  return findings;
}

function buildLocalAnalysis(traces, findings) {
  const affectedServices = [...new Set(traces.map((trace) => trace.serviceName))];
  const highest = findings.some((finding) => finding.severity === 'high') ? 'high' : findings.length ? 'medium' : 'low';
  return {
    source: 'rule-based',
    severity: highest,
    summary: findings.length ? `${findings.length} suspicious condition(s) detected across ${affectedServices.join(', ') || 'the service'}.` : 'No suspicious conditions were found in the selected traces.',
    affectedServices,
    observedFacts: findings.map((finding) => `${finding.message} (trace ${finding.traceId}${finding.spanId ? `, span ${finding.spanId}` : ''})`),
    hypotheses: findings.length ? ['The slow or failed operation identified above is the most likely contributor; inspect its dependency and recent deployment changes.'] : [],
    recommendations: ['Review the referenced trace and span timings.', 'Compare affected endpoints with a healthy request.', 'Check application and dependency logs around the trace start time.'],
    findings,
  };
}

module.exports = { detectFindings, buildLocalAnalysis };
