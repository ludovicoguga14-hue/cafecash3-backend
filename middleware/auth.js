const { admin, firestore } = require('../firebase');

async function authenticate(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const idToken = header.slice(7);

    try {
        const decoded = await admin.auth().verifyIdToken(idToken);

        const userDoc = await firestore.collection('users').doc(decoded.uid).get();
        if (!userDoc.exists) {
            return res.status(401).json({
                success: false,
                error: 'User profile not found'
            });
        }

        const user = { uid: decoded.uid, ...userDoc.data() };

        // Auto-downgrade expired premium
        if (user.plan === 'premium' && user.planExpiresAt) {
            const expiresAt = user.planExpiresAt.toDate
                ? user.planExpiresAt.toDate()
                : new Date(user.planExpiresAt);
            if (expiresAt < new Date()) {
                await firestore.collection('users').doc(decoded.uid).update({
                    plan: 'basic',
                    planExpiresAt: null
                });
                user.plan = 'basic';
                user.planExpiresAt = null;
            }
        }

        const ctx = await resolveContext(decoded.uid, req, user);

        req.user = user;
        req.user.universityId = ctx.university ? ctx.university.id : null;
        req.user.university = ctx.university || null;
        req.user.cafeId = ctx.cafe ? ctx.cafe.id : null;
        req.user.activeCafe = ctx.cafe || null;
        req.user.timezone = ctx.cafe ? ctx.cafe.timezone : 'Africa/Johannesburg';
        req.user.role = user.role || 'manager';

        next();
    } catch (err) {
        console.error('❌ Auth failed:', { code: err.code, message: err.message });
        return res.status(401).json({
            success: false,
            error: err.code === 'auth/id-token-expired'
                ? 'Token expired'
                : 'Invalid or unauthorized token'
        });
    }
}

async function resolveContext(uid, req, user) {
    const unisSnap = await firestore
        .collection('users').doc(uid)
        .collection('universities').get();

    if (unisSnap.empty) return { university: null, cafe: null };

    const universities = unisSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allCafes = [];

    for (const uDoc of unisSnap.docs) {
        const cafesSnap = await firestore
            .collection('users').doc(uid)
            .collection('universities').doc(uDoc.id)
            .collection('cafes').get();

        cafesSnap.forEach(cDoc => {
            allCafes.push({ id: cDoc.id, ...cDoc.data(), universityId: uDoc.id });
        });
    }

    const headerCafeId = req.headers['x-cafe-id'];
    if (headerCafeId) {
        const cafe = allCafes.find(c => c.id === headerCafeId);
        if (cafe) return {
            university: universities.find(u => u.id === cafe.universityId),
            cafe
        };
    }

    if (user.lastActiveCafeId) {
        const cafe = allCafes.find(c => c.id === user.lastActiveCafeId);
        if (cafe) return {
            university: universities.find(u => u.id === cafe.universityId),
            cafe
        };
    }

    if (allCafes.length > 0) {
        const cafe = allCafes[0];
        return {
            university: universities.find(u => u.id === cafe.universityId),
            cafe
        };
    }

    return { university: universities[0], cafe: null };
}

function requirePremium(req, res, next) {
    if (!req.user || req.user.plan !== 'premium') {
        return res.status(403).json({
            success: false,
            error: 'Premium required',
            upgrade: true
        });
    }
    next();
}

function requireCafe(req, res, next) {
    if (!req.user || !req.user.cafeId) {
        return res.status(400).json({
            success: false,
            error: 'No active cafeteria'
        });
    }
    next();
}

module.exports = { authenticate, requirePremium, requireCafe, resolveContext };
