require('dotenv').config();

const { validateEnv } = require('./config/env');
validateEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 8080;

// CRITICAL: Trust proxy (required for Render)
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: false }));

// CORS: allows any localhost port + CORS_ORIGIN env list
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }
        const allowed = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim());
        if (allowed.includes(origin)) return callback(null, true);
        console.warn('❌ CORS blocked:', origin);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// ROUTES
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/stock/items', require('./routes/inventory'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/cafes', require('./routes/cafes'));
app.use('/api/preferences', require('./routes/preferences'));
app.use('/api/smart', require('./routes/quickActions'));
app.use('/api/waste', require('./routes/waste'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/expenses', require('./routes/reports'));
app.use('/api/themes', require('./routes/themes'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/support', require('./routes/support'));
app.use('/api/users', require('./routes/users'));
app.use('/api/ai', require('./routes/ai'));

// HEALTH
app.get('/api/health', (req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ERROR
app.use((err, req, res, next) => {
    console.error('❌ Error:', { message: err.message, path: req.path });
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ success: false, error: 'Origin not allowed' });
    }
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});

app.listen(PORT, () => {
    console.log('');
    console.log('🚀 ═══════════════════════════════════════════════════════');
    console.log('🚀 CafeCash Backend running on http://localhost:' + PORT);
    console.log('🚀 Environment: ' + (process.env.NODE_ENV || 'development'));
    console.log('🚀 ═══════════════════════════════════════════════════════');
    console.log('');
});
