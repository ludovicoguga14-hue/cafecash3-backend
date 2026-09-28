const express = require('express');
const { authenticate, requireCafe } = require('../middleware/auth');
const suppliersRepo = require('../repositories/suppliersRepo');

const router = express.Router();
router.use(authenticate, requireCafe);

router.get('/', async (req, res, next) => {
    try {
        const suppliers = await suppliersRepo.list(req.user.uid, req.user.universityId, req.user.cafeId);
        res.json({ success: true, data: suppliers });
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    try {
        const { name, contact, email, phone } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Name required' });
        const supplier = await suppliersRepo.create(
            req.user.uid, req.user.universityId, req.user.cafeId,
            { name, contact, email, phone }
        );
        res.status(201).json({ success: true, data: supplier });
    } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        await suppliersRepo.remove(req.user.uid, req.user.universityId, req.user.cafeId, req.params.id);
        res.json({ success: true, message: 'Deleted' });
    } catch (err) { next(err); }
});

router.get('/ledger/all', async (req, res, next) => {
    try {
        const suppliers = await suppliersRepo.list(req.user.uid, req.user.universityId, req.user.cafeId);
        const all = await Promise.all(suppliers.map(async s => {
            const entries = await suppliersRepo.ledgerList(
                req.user.uid, req.user.universityId, req.user.cafeId, s.id
            );
            return entries.map(e => ({ ...e, supplierName: s.name }));
        }));
        const flat = all.flat().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        res.json({ success: true, data: flat });
    } catch (err) { next(err); }
});

router.post('/ledger', async (req, res, next) => {
    try {
        const { supplier_id, invoice_no, amount, due_date, status, date } = req.body;
        if (!supplier_id || !amount) {
            return res.status(400).json({ success: false, error: 'Supplier and amount required' });
        }

        const entry = await suppliersRepo.ledgerCreate(
            req.user.uid, req.user.universityId, req.user.cafeId, supplier_id,
            {
                invoiceNo: invoice_no || null,
                amount: Number(amount),
                dueDate: due_date || null,
                status: status || 'pending',
                date: date || new Date().toISOString().slice(0, 10)
            }
        );

        res.status(201).json({ success: true, data: entry });
    } catch (err) { next(err); }
});

module.exports = router;
