const express = require('express');
const { authenticate, requireCafe } = require('../middleware/auth');
const recipesRepo = require('../repositories/recipesRepo');
const itemsRepo = require('../repositories/itemsRepo');
const { round2 } = require('../utils/calc');

const router = express.Router();
router.use(authenticate, requireCafe);

async function computeRecipe(recipe, uid, universityId, cafeId) {
    const ingredients = recipe.ingredients || [];
    let totalCost = 0;

    const enriched = await Promise.all(ingredients.map(async ing => {
        const item = ing.itemId
            ? await itemsRepo.get(uid, universityId, cafeId, ing.itemId)
            : null;
        const unitCost = item?.cost || ing.cost || 0;
        const lineCost = unitCost * (ing.qty || 0);
        totalCost += lineCost;
        return { ...ing, unitCost, lineCost: round2(lineCost) };
    }));

    const yieldQty = recipe.yieldQty || 1;
    const costPerUnit = totalCost / yieldQty;
    const sellingPrice = recipe.sellingPrice || 0;
    const margin = sellingPrice > 0
        ? ((sellingPrice - costPerUnit) / sellingPrice * 100)
        : 0;

    return {
        ingredients: enriched,
        totalCost: round2(totalCost),
        costPerUnit: round2(costPerUnit),
        sellingPrice,
        margin: round2(margin),
        profit: round2(sellingPrice - costPerUnit)
    };
}

router.get('/', async (req, res, next) => {
    try {
        const rows = await recipesRepo.list(req.user.uid, req.user.universityId, req.user.cafeId);
        res.json({ success: true, data: rows });
    } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
    try {
        const recipe = await recipesRepo.get(
            req.user.uid, req.user.universityId, req.user.cafeId, req.params.id
        );
        if (!recipe) return res.status(404).json({ success: false, error: 'Not found' });

        const computed = await computeRecipe(
            recipe, req.user.uid, req.user.universityId, req.user.cafeId
        );
        res.json({ success: true, data: { ...recipe, ...computed } });
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    try {
        const { name, category, yieldQty, sellingPrice, ingredients } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Name required' });

        const recipe = await recipesRepo.create(
            req.user.uid, req.user.universityId, req.user.cafeId,
            {
                name, category: category || 'Other',
                yieldQty: yieldQty || 1,
                sellingPrice: sellingPrice || 0,
                ingredients: ingredients || []
            }
        );

        res.status(201).json({ success: true, data: recipe });
    } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
    try {
        const updated = await recipesRepo.update(
            req.user.uid, req.user.universityId, req.user.cafeId,
            req.params.id, req.body
        );
        res.json({ success: true, data: updated });
    } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        await recipesRepo.remove(
            req.user.uid, req.user.universityId, req.user.cafeId, req.params.id
        );
        res.json({ success: true, message: 'Deleted' });
    } catch (err) { next(err); }
});

module.exports = router;
