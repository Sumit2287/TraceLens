const express = require('express');
const router = express.Router();
const telemetry = require('../telemetry/store');
const { detectFindings, buildLocalAnalysis } = require('../analysis/incident');
const { callGroq } = require('../analysis/groq');

router.get('/', (req, res) => {
  res.send('Hello, World!');
});

router.get('/health-check', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

router.get('/about', (req, res) => {
  res.send('About Page');
});

router.get('/api/summary', (req, res) => res.json(telemetry.getSummary()));

router.get('/api/traces', (req, res) => {
  res.json(telemetry.listTraces({ service: req.query.service, status: req.query.status, from: req.query.from, to: req.query.to, limit: req.query.limit }));
});

router.get('/api/traces/:traceId', (req, res) => {
  const trace = telemetry.getTrace(req.params.traceId);
  if (!trace) return res.status(404).json({ error: 'Trace not found' });
  return res.json(trace);
});

router.post('/api/analyze-incident', express.json({ limit: '20kb' }), async (req, res) => {
  const body = req.body || {};
  if (body.traceIds !== undefined && (!Array.isArray(body.traceIds) || body.traceIds.some((id) => typeof id !== 'string'))) {
    return res.status(400).json({ error: 'traceIds must be an array of strings' });
  }
  const traces = body.traceIds
    ? body.traceIds.slice(0, 50).map((id) => telemetry.getTrace(id)).filter(Boolean)
    : telemetry.listTraces({ limit: 50 });
  const findings = detectFindings(traces);
  const localAnalysis = buildLocalAnalysis(traces, findings);
  try {
    const aiAnalysis = await callGroq(localAnalysis, traces);
    return res.json(aiAnalysis || localAnalysis);
  } catch (error) {
    console.error('Incident analysis provider error:', error.message);
    return res.status(200).json({ ...localAnalysis, providerError: 'Groq is unavailable; showing rule-based analysis.' });
  }
});

module.exports = router;