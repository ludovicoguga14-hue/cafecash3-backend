const express = require('express');
const { authenticate, requireCafe } = require('../middleware/auth');
const { ask } = require('../ai/engine');
const { forecastStock } = require('../ai/predictors/stockForecast');

const router = express.Router();
router.use(authenticate);

router.post('/ask', async (req, res, next) => {
    try {
        const { message, cafeId, history } = req.body;
        if (!message) return res.status(400).json({ success: false, error: 'Message required' });

        const response = await ask({
            uid: req.user.uid,
            cafeId: cafeId || req.user.cafeId,
            message,
            history: Array.isArray(history) ? history : []
        });

        res.json({ success: true, data: response });
    } catch (err) { next(err); }
});

router.get('/insights', async (req, res, next) => {
    try {
        if (!req.user.activeCafe) {
            return res.json({ success: true, data: [], forecast: [] });
        }

        const forecast = await forecastStock(req.user.uid, req.user.activeCafe);
        const critical = forecast.filter(f => f.status === 'critical');
        const warning = forecast.filter(f => f.status === 'warning');

        const insights = [];
        if (critical.length) {
            insights.push({
                type: 'critical',
                icon: '🚨',
                title: `${critical.length} item(s) will run out soon`,
                text: critical.slice(0, 3).map(i => `${i.name} (~${i.daysLeft}d)`).join(', ')
            });
        }
        if (warning.length) {
            insights.push({
                type: 'warning',
                icon: '⚠️',
                title: `${warning.length} item(s) running low`,
                text: warning.slice(0, 3).map(i => i.name).join(', ')
            });
        }

        res.json({ success: true, data: insights, forecast: forecast.slice(0, 10) });
    } catch (err) { next(err); }
});

router.get('/production-plan', requireCafe, async (req, res, next) => {
    try {
        const { analyzeProduction } = require('../ai/analyzers/production');
        const { buildContext } = require('../ai/context');
        const ctx = await buildContext(req.user.uid, req.user.cafeId);
        const plan = analyzeProduction(ctx);
        res.json({ success: true, data: plan });
    } catch (err) { next(err); }
});

module.exports = router;
