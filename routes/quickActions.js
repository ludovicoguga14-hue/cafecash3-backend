const express = require('express');
const { authenticate } = require('../middleware/auth');
const itemsRepo = require('../repositories/itemsRepo');
const salesRepo = require('../repositories/salesRepo');
const cafesRepo = require('../repositories/cafesRepo');
const universitiesRepo = require('../repositories/universitiesRepo');
const { todayForCafe } = require('../utils/time');
const { isLowStock } = require('../utils/calc');

const router = express.Router();
router.use(authenticate);

router.get('/quick-actions', async (req, res, next) => {
    try {
        const cafe = req.user.activeCafe;
        const university = req.user.university;

        if (!cafe) {
            return res.json({
                success: true,
                data: {
                    activeCafe: null,
                    activeUniversity: university,
                    lowStock: [],
                    todaySales: { revenue: 0, orders: 0 },
                    plan: req.user.plan
                }
            });
        }

        const [items, todaySales, cafes, universities] = await Promise.all([
            itemsRepo.list(req.user.uid, req.user.universityId, cafe.id),
            salesRepo.salesInRange(
                req.user.uid, req.user.universityId, cafe.id,
                todayForCafe(cafe), todayForCafe(cafe)
            ),
            cafesRepo.listAll(req.user.uid),
            universitiesRepo.list(req.user.uid)
        ]);

        const lowStock = items.filter(isLowStock).slice(0, 5);

        res.json({
            success: true,
            data: {
                activeCafe: cafe,
                activeUniversity: university,
                cafeCount: cafes.length,
                universityCount: universities.length,
                lowStock,
                todaySales: {
                    revenue: todaySales.reduce((s, x) => s + (x.revenue || 0), 0),
                    orders: todaySales.length
                },
                recentItems: items.slice(0, 5),
                plan: req.user.plan
            }
        });
    } catch (err) { next(err); }
});

module.exports = router;
