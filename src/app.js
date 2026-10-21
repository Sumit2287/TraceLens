require('dotenv').config();
const { initializeTracing } = require('./config/tracing');  // Import tracing initialization
const express = require('express');
const actuator = require('express-actuator');
const routes = require('./routes'); // Import routes
const actuatorConfig = require('./config/actuatorConfig');
const prometheusConfig = require('./config/prometheusConfig');
const { register, httpRequestCounter, responseTimeHistogram } = prometheusConfig;
const packageJson = require('../package.json'); // Import package.json
const { trace } = require('@opentelemetry/api');
const telemetry = require('./telemetry/store');

const app = express();
const port = process.env.PORT || 30001;

// Middleware to track request metrics
app.use((req, res, next) => {
  const activeSpan = trace.getActiveSpan();
  const requestTrace = telemetry.createTrace({
    req,
    traceId: activeSpan ? activeSpan.spanContext().traceId : undefined,
    serviceName: process.env.OTEL_SERVICE_NAME || packageJson.name,
  });
  const end = responseTimeHistogram.startTimer();
  res.on('finish', () => {
    // Record metrics
    httpRequestCounter.inc({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status: res.statusCode,
    });
    end({ method: req.method, route: req.route ? req.route.path : req.path, status: res.statusCode });
    telemetry.finishTrace(requestTrace, { status: res.statusCode });
  });
  res.on('close', () => {
    if (!requestTrace.status) telemetry.finishTrace(requestTrace, { status: 499, error: 'Request closed before response' });
  });
  next();
});

// Apply actuator middleware
app.use(actuator(actuatorConfig));

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const path = require('path');
app.get('/', (req, res) => res.send('Hello, World!'));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.use(express.static(path.join(__dirname, '../public')));

// Register other routes
app.use('/', routes);

const tracer = trace.getTracer(packageJson.name);
app.get('/custom', (req, res) => {
  const span = tracer.startSpan('custom-endpoint');
  setTimeout(() => {
    span.end();
    res.send('Custom operation complete');
  }, 500);
});

if (require.main === module) {
  initializeTracing().then(() => {
    app.listen(port, () => console.log(`TraceLens running at http://localhost:${port}`));
  }).catch((error) => {
    console.error('Error starting server', error);
    process.exitCode = 1;
  });
}

module.exports = app;