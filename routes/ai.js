const express = require('express');
const { authenticate, requireCafe } = require('../middleware/auth');
const { firestore } = require('../firebase');

const router = express.Router();
router.use(authenticate);

router.get('/insights', requireCafe, async (req, res, next) => {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

        const salesSnap = await firestore
            .collection('users').doc(req.user.uid)
            .collection('universities').doc(req.user.universityId)
            .collection('cafes').doc(req.user.cafeId)
            .collection('sales')
            .where('date', '>=', monthAgo)
            .where('date', '<=', today)
            .get();

        const sales = salesSnap.docs.map(d => d.data());

        const itemSales = {};
        sales.forEach(s => {
            itemSales[s.itemName] = (itemSales[s.itemName] || 0) + (s.qty || 0);
        });

        const itemsSnap = await firestore
            .collection('users').doc(req.user.uid)
            .collection('universities').doc(req.user.universityId)
            .collection('cafes').doc(req.user.cafeId)
            .collection('items').get();

        const items = itemsSnap.docs.map(d => d.data());

        const lowStock = items.filter(i => (i.qty || 0) <= (i.lowStockThreshold || 5));

        const insights = [];
        if (lowStock.length) {
            insights.push({
                type: 'warning',
                icon: '⚠️',
                title: lowStock.length + ' item(s) running low',
                text: lowStock.slice(0, 3).map(i => i.name).join(', ')
            });
        }

        res.json({ success: true, data: insights, forecast: [] });
    } catch (err) { next(err); }
});

router.post('/ask', requireCafe, async (req, res, next) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ success: false, error: 'Message required' });

        const lower = message.toLowerCase();

        // Simple local AI — reads real data
        const today = new Date().toISOString().slice(0, 10);

        const salesSnap = await firestore
            .collection('users').doc(req.user.uid)
            .collection('universities').doc(req.user.universityId)
            .collection('cafes').doc(req.user.cafeId)
            .collection('sales')
            .where('date', '==', today)
            .get();

        const todaySales = salesSnap.docs.map(d => d.data());
        const revenue = todaySales.reduce((s, x) => s + (x.revenue || 0), 0);
        const orders = todaySales.length;

        let reply = '';

        if (lower.includes('sold') || lower.includes('revenue') || lower.includes('today')) {
            reply = `Today you made R${revenue.toFixed(2)} from ${orders} order(s).`;
        } else if (lower.includes('low') || lower.includes('stock')) {
            const itemsSnap = await firestore
                .collection('users').doc(req.user.uid)
                .collection('universities').doc(req.user.universityId)
                .collection('cafes').doc(req.user.cafeId)
                .collection('items').get();
            const low = itemsSnap.docs.map(d => d.data()).filter(i => (i.qty || 0) <= (i.lowStockThreshold || 5));
            reply = low.length ? `Low stock: ${low.map(i => i.name + ' (' + i.qty + ')').join(', ')}` : 'All stock is fine.';
        } else {
            reply = `I can help with sales, stock, profit, or waste. Ask me anything about your business.`;
        }

        res.json({
            success: true,
            data: { text: reply, intent: 'general', provider: 'local' }
        });
    } catch (err) { next(err); }
});

module.exports = router;
