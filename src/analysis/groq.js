const https = require('https');

function callGroq(analysis, traces) {
  if (!process.env.GROQ_API_KEY) return Promise.resolve(null);
  const payload = JSON.stringify({
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    temperature: 0.1,
    messages: [
      { role: 'system', content: 'You are a careful incident analyst. Separate observed facts from hypotheses. Cite only supplied traceId, spanId, timings, statuses, and errors. Return concise JSON with severity, summary, affectedServices, observedFacts, hypotheses, recommendations.' },
      { role: 'user', content: JSON.stringify({ findings: analysis.findings, traces: traces.map(({ traceId, serviceName, method, route, status, durationMs, spans, error }) => ({ traceId, serviceName, method, route, status, durationMs, spans, error })) }) },
    ],
  });
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      timeout: 10000,
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`Groq request failed with status ${response.statusCode}`));
        try {
          const content = JSON.parse(body).choices?.[0]?.message?.content;
          if (!content) return reject(new Error('Groq returned no analysis'));
          const json = content.match(/\{[\s\S]*\}/);
          resolve(json ? { ...JSON.parse(json[0]), source: 'groq' } : { ...analysis, summary: content, source: 'groq' });
        } catch (error) { reject(new Error(`Invalid Groq response: ${error.message}`)); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Groq request timed out')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

module.exports = { callGroq };
