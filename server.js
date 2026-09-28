
require('dotenv').config();
const { validateEnv } = require('./config/env');
validateEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler, notFound } = require('./middleware/error');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet({ crossOriginResourcePolicy: false }));
const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (Postman, server-to-server, etc.)
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        console.warn(`🚫 CORS blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Cafe-Id',
        'X-University-Id'
    ],
    optionsSuccessStatus: 204
}));

app.options('*', cors());
app.use(express.json({ limit: '1mb' }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

// ─── Routes ───
app.use('/api/auth', require('./routes/auth'));
app.use('/api/universities', require('./routes/universities'));
app.use('/api/cafes', require('./routes/cafes'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/stock/items', require('./routes/inventory'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/expenses', require('./routes/reports'));
app.use('/api/themes', require('./routes/themes'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/support', require('./routes/support'));
app.use('/api/users', require('./routes/users'));
app.use('/api/preferences', require('./routes/preferences'));
app.use('/api/smart', require('./routes/quickActions'));
app.use('/api/waste', require('./routes/waste'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/ai', require('./routes/ai'));

app.get('/api/health', (req, res) =>
    res.json({ success: true, status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() }));

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`\n🍽️  Food Market SA running on http://localhost:${PORT}`);
    console.log(`🔐 Firebase Auth + Firestore`);
    console.log(`🤖 AI provider: ${process.env.AI_PROVIDER || 'local'}`);
    console.log(`🎓 University → Cafeteria → Manager hierarchy`);
    console.log(`⏰ Timezone-aware queries\n`);
});
