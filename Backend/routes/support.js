const express = require('express');
const { authenticate } = require('../middleware/auth');
const { firestore } = require('../firebase');

const router = express.Router();

router.get('/tickets', authenticate, async (req, res, next) => {
    try {
        const snap = await firestore.collection('support_tickets')
            .where('userId', '==', req.user.uid)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch (err) { next(err); }
});

router.post('/tickets', authenticate, async (req, res, next) => {
    try {
        const { subject, category, priority, description } = req.body;
        if (!subject || !description) {
            return res.status(400).json({ success: false, error: 'Subject and description required' });
        }

        const ref = await firestore.collection('support_tickets').add({
            userId: req.user.uid,
            userEmail: req.user.email,
            universityId: req.user.universityId,
            cafeId: req.user.cafeId,
            subject,
            category: category || 'other',
            priority: priority || 'normal',
            description,
            status: 'open',
            createdAt: new Date()
        });

        const doc = await ref.get();
        res.status(201).json({ success: true, data: { id: doc.id, ...doc.data() } });
    } catch (err) { next(err); }
});

router.get('/chat/:sessionId/messages', authenticate, async (req, res, next) => {
    try {
        const snap = await firestore.collection('support_messages')
            .where('sessionId', '==', req.params.sessionId)
            .orderBy('createdAt', 'asc')
            .limit(100)
            .get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch (err) { next(err); }
});

router.post('/chat/:sessionId/messages', authenticate, async (req, res, next) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ success: false, error: 'Content required' });

        await firestore.collection('support_messages').add({
            sessionId: req.params.sessionId,
            userId: req.user.uid,
            role: 'user',
            content,
            createdAt: new Date()
        });
        res.json({ success: true, message: 'Sent' });
    } catch (err) { next(err); }
});

router.post('/chat/start', authenticate, async (req, res) => {
    const sessionId = 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    await firestore.collection('support_messages').add({
        sessionId,
        userId: req.user.uid,
        role: 'bot',
        content: `👋 Hi ${req.user.name}! How can we help you today?`,
        createdAt: new Date()
    });
    res.json({ success: true, data: { sessionId, userId: req.user.uid } });
});

router.get('/faq', (req, res) => {
    res.json({
        success: true,
        data: [
            { id: 'faq_1', category: 'Getting Started', question: 'How do I add a product?', answer: 'Go to Inventory → Add Product and fill in the details.' },
            { id: 'faq_2', category: 'Billing', question: 'How do I upgrade to Premium?', answer: 'Click the crown icon in Smart Control or your plan badge.' },
            { id: 'faq_3', category: 'Cafeterias', question: 'Can I manage multiple cafeterias?', answer: 'Yes on Premium. Use Smart Control → Cafeterias tab to switch between locations.' },
            { id: 'faq_4', category: 'Universities', question: 'Can I manage multiple universities?', answer: 'Yes on Premium. Each university can have multiple cafeterias.' },
            { id: 'faq_5', category: 'AI', question: 'What can the AI do?', answer: 'Ask about sales, stock, profit, waste, or production. It uses your real business data.' }
        ]
    });
});

module.exports = router;
