const $ = (selector) => document.querySelector(selector);
async function load() {
  const status = $('#status').value;
  const [summary, traces] = await Promise.all([fetch('/api/summary').then((r) => r.json()), fetch(`/api/traces${status ? `?status=${status}` : ''}`).then((r) => r.json())]);
  $('#summary').innerHTML = [['Requests', summary.totalRequests], ['Error rate', `${(summary.errorRate * 100).toFixed(1)}%`], ['Avg latency', `${summary.averageResponseTimeMs}ms`], ['p95 latency', `${summary.p95LatencyMs}ms`], ['Throughput', `${summary.throughputPerMinute}/min`]].map(([label, value]) => `<div class="card"><span class="muted">${label}</span><strong>${value}</strong></div>`).join('');
  $('#traces').innerHTML = traces.length ? traces.map((trace) => `<article class="trace" data-id="${trace.traceId}"><div class="trace-row"><strong>${trace.method} ${trace.route}</strong><span class="pill ${trace.status >= 400 ? 'bad' : ''}">${trace.status}</span></div><span class="muted">${trace.serviceName} · ${trace.durationMs}ms · ${trace.traceId}</span><div class="bar" style="width:${Math.min(100, Math.max(3, trace.durationMs / 10))}%"></div></article>`).join('') : '<p class="muted">No traces yet. Call an API endpoint, then refresh.</p>';
  document.querySelectorAll('.trace').forEach((element) => element.addEventListener('click', async () => { const trace = await fetch(`/api/traces/${encodeURIComponent(element.dataset.id)}`).then((r) => r.json()); alert(JSON.stringify(trace, null, 2)); }));
}
$('#refresh').addEventListener('click', load); $('#status').addEventListener('change', load);
$('#analyze').addEventListener('click', async () => { $('#analysis').classList.remove('hidden'); $('#analysis-body').textContent = 'Analyzing…'; const response = await fetch('/api/analyze-incident', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' }); const result = await response.json(); $('#analysis-body').textContent = JSON.stringify(result, null, 2); });
load().catch((error) => { $('#traces').textContent = error.message; });
