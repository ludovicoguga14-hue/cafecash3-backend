/**
 * Firebase ID token verification + University + Café isolation.
 */
const { admin, firestore } = require('../firebase');
const db = require('../config/db');

async function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const idToken = header.slice(7);

    try {
        // 1. Verify Firebase ID token
        const decoded = await admin.auth().verifyIdToken(idToken, true);

        // 2. Load user profile
        const userDoc = await firestore.collection('users').doc(decoded.uid).get();
        if (!userDoc.exists) {
            return res.status(401).json({ success: false, error: 'User profile not found' });
        }

        const user = { uid: decoded.uid, ...userDoc.data() };

        // 3. Auto-downgrade expired premium
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

        // 4. Resolve active university + café (ownership verified)
        const context = await resolveContext(decoded.uid, req, user);

        // 5. Attach — ORDER MATTERS
        req.user = user;
        req.user.universityId = context.university?.id || null;
        req.user.university = context.university || null;
        req.user.cafeId = context.cafe?.id || null;
        req.user.activeCafe = context.cafe || null;
        req.user.timezone = context.cafe?.timezone || 'Africa/Johannesburg';
        req.user.role = context.role || 'manager';

        next();
    } catch (err) {
        console.error('Auth error:', err.code || err.message);
        const status = err.code === 'auth/id-token-expired' ? 401 : 403;
        return res.status(status).json({
            success: false,
            error: err.code === 'auth/id-token-expired'
                ? 'Token expired — please sign in again'
                : 'Invalid or unauthorized token'
        });
    }
}

/**
 * Resolves the active university and café with ownership verification.
 * Priority:
 *   1. X-Cafe-Id header (verified owned)
 *   2. X-University-Id header (verified)
 *   3. user.lastActiveCafeId
 *   4. First owned café
 */
async function resolveContext(uid, req, user) {
    // Get all universities this user has access to
    const universitiesSnap = await firestore.collection('users').doc(uid)
        .collection('universities').get();

    // Collect all cafés across all universities
    let allCafes = [];
    const universities = [];

    for (const uDoc of universitiesSnap.docs) {
        const university = { id: uDoc.id, ...uDoc.data() };
        universities.push(university);

        const cafesSnap = await firestore.collection('users').doc(uid)
            .collection('universities').doc(uDoc.id)
            .collection('cafes').get();

        cafesSnap.forEach(cDoc => {
            allCafes.push({
                id: cDoc.id,
                ...cDoc.data(),
                universityId: uDoc.id,
                universityName: university.name
            });
        });
    }

    // If user has no universities yet, they need onboarding
    if (!universities.length) {
        return { university: null, cafe: null, role: 'manager' };
    }

    // 1. Header-based café selection
    const headerCafeId = req.headers['x-cafe-id'];
    if (headerCafeId) {
        const cafe = allCafes.find(c => c.id === headerCafeId);
        if (cafe) {
            const university = universities.find(u => u.id === cafe.universityId);
            return { university, cafe, role: user.role || 'manager' };
        }
    }

    // 2. Header-based university selection
    const headerUniversityId = req.headers['x-university-id'];
    if (headerUniversityId) {
        const university = universities.find(u => u.id === headerUniversityId);
        if (university) {
            const cafe = allCafes.find(c => c.universityId === university.id) || null;
            return { university, cafe, role: user.role || 'manager' };
        }
    }

    // 3. user.lastActiveCafeId
    if (user.lastActiveCafeId) {
        const cafe = allCafes.find(c => c.id === user.lastActiveCafeId);
        if (cafe) {
            const university = universities.find(u => u.id === cafe.universityId);
            return { university, cafe, role: user.role || 'manager' };
        }
    }

    // 4. First owned café
    if (allCafes.length) {
        const cafe = allCafes[0];
        const university = universities.find(u => u.id === cafe.universityId);
        return { university, cafe, role: user.role || 'manager' };
    }

    // Fallback: university but no café
    return { university: universities[0], cafe: null, role: user.role || 'manager' };
}

function requirePremium(req, res, next) {
    if (req.user.plan !== 'premium') {
        return res.status(403).json({
            success: false,
            error: 'Premium plan required',
            upgrade: true
        });
    }
    next();
}

function requireCafe(req, res, next) {
    if (!req.user.cafeId) {
        return res.status(400).json({ success: false, error: 'No active cafeteria selected' });
    }
    next();
}

function requireUniversityAdmin(req, res, next) {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ success: false, error: 'University admin access required' });
    }
    next();
}

module.exports = {
    authenticate,
    requirePremium,
    requireCafe,
    requireUniversityAdmin,
    resolveContext
};
