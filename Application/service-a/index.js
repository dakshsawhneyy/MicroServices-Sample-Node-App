import express from 'express';
import promClient from 'prom-client';
import morgan from 'morgan';
import axios from 'axios';

const app = express();

const PORT = 9000;

// Prometheus Metrics
const httpRequestCounter = promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status_code']
}) 
const httpRequestDuration = promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'path', 'status_code'],
    buckets: [0.1, 0.5, 1, 2.5, 5, 10]      // Buckets for the histogram in seconds
})
const requestDurationSummary = promClient.Summary({
    name: 'http_request_duration_summary_seconds',
    help: 'Summary of HTTP request durations in seconds',
    labelNames: ['method', 'path', 'status_code'],
    percentiles: [0.5, 0.9, 0.99]           // Percentiles to calculate
})


// Middleware for morgan
app.use(morgan('common'))   // logs everything and sends them as stdout

// Middleware to parse JSON requests and adding labels to metrics so it can track metrics
app.use((req,res,next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}s`);

        httpRequestCounter.labels({ method: req.method, path: req.path, status_code: res.statusCode }).inc();
        httpRequestDuration.labels({ method: req.method, path: req.path, status_code: res.statusCode }).observe(duration);
        requestDurationSummary.labels({ method: req.method, path: req.path, status_code: res.statusCode }).observe(duration);
    })
    next();
})


// Handling Requests
app.get('/', (req,res) => {
    res.status(200).json({message: 'Hello from Service A'});
})

app.get('/healthy', (req, res) => {
    res.status(200).json({
        name: "👀 - Obserability 🔥- Daksh Sawhney",
        status: "healthy"
    })
});

app.get('/serverError', (req, res) => {
    res.status(500).json({
        error: " Internal server error",
        statusCode: 500
    })
});

app.get('/notFound', (req, res) => {
    res.status(404).json({
        error: "Not Found",
        statusCode: "404"
    })
});

// Simulate a crash by throwing an error
app.get('/crash', (req, res) => {
    console.log('Intentionally crashing the server...');
    process.exit(1);
});


// Sending personalized logs to /metrics
app.get('/metrics', (req,res) => {
    res.set('Content-Type', promClient.register.contentType);
    const metrics = promClient.register.metrics();
    res.end(metrics);
})

// Call service B
app.get('/call-service-b', async(req,res) => {
    try {
        const response = await axios.get(`localhost:9001/hello`);
        res.send(`<h1 style="font-size: 100px">Service B says: ${response.data}<h1>`);
    } catch (error) {
        res.status(500).json({error: 'Failed to call Service B'});
        console.error(error)
    }
})


app.listen(PORT, () => {
  console.log(`Service A is running on port ${PORT}`);
});
