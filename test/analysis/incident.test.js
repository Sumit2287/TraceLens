const chai = require('chai');
const { detectFindings, buildLocalAnalysis } = require('../../src/analysis/incident');

const { expect } = chai;

describe('Incident analysis', () => {
  it('detects failed, slow, and database operations', () => {
    const traces = [{ traceId: 'trace-1', serviceName: 'api', method: 'GET', route: '/orders', status: 500, durationMs: 1200, spans: [{ spanId: 'span-1', name: 'query orders', type: 'database', durationMs: 400 }] }];
    const findings = detectFindings(traces);
    expect(findings.map((finding) => finding.type)).to.include.members(['http-error', 'slow-request', 'slow-database']);
    expect(buildLocalAnalysis(traces, findings).observedFacts.join(' ')).to.include('trace-1');
  });

  it('handles an empty telemetry set', () => {
    expect(buildLocalAnalysis([], [])).to.include({ severity: 'low', source: 'rule-based' });
  });
});
