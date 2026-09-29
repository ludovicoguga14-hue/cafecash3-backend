/**
 * ═══════════════════════════════════════════════════════════════════
 * CafeCash — Authentication Middleware
 * ═══════════════════════════════════════════════════════════════════
 *
 * Verifies Firebase ID token from Authorization header.
 * Attaches user + active café + timezone to req.user.
 */

const { admin, firestore } = require('../firebase');

/**
 * Verify Firebase ID token and load user profile.
 */
async function authenticate(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'No authentication token provided'
        });
    }

    const idToken = header.slice(7);

    try {
        // 1. Verify the Firebase ID token
        const decoded = await admin.auth().verifyIdToken(idToken, true);

        // 2. Load the user's profile from Firestore
        const userDoc = await firestore.collection('users').doc(decoded.uid).get();

        if (!userDoc.exists) {
            return res.status(401).json({
                success: false,
                error: 'User profile not found. Please complete signup.'
            });
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

        // 4. Resolve active café (with ownership verification)
        const context = await resolveContext(decoded.uid, req, user);

        // 5. Attach to request — ORDER MATTERS
        req.user = user;
        req.user.universityId = context.university ? context.university.id : null;
        req.user.university = context.university || null;
        req.user.cafeId = context.cafe ? context.cafe.id : null;
        req.user.activeCafe = context.cafe || null;
        req.user.timezone = context.cafe ? context.cafe.timezone : 'Africa/Johannesburg';
        req.user.role = user.role || 'manager';

        next();

    } catch (err) {
        console.error('❌ Auth error:', {
            code: err.code,
            message: err.message,
            path: req.path,
            method: req.method
        });

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
 * Resolves the active university and café for the user.
 * Priority:
 *   1. X-Cafe-Id header
 *   2. X-University-Id header
 *   3. user.lastActiveCafeId
 *   4. First café owned
 */
async function resolveContext(uid, req, user) {
    // Load all universities owned by user
    const universitiesSnap = await firestore
        .collection('users').doc(uid)
        .collection('universities')
        .get();

    if (universitiesSnap.empty) {
        return { university: null, cafe: null };
    }

    const universities = universitiesSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
    }));

    // Collect all cafés across all universities
    const allCafes = [];
    for (const uDoc of universitiesSnap.docs) {
        const cafesSnap = await firestore
            .collection('users').doc(uid)
            .collection('universities').doc(uDoc.id)
            .collection('cafes')
            .get();

        cafesSnap.forEach(cDoc => {
            allCafes.push({
                id: cDoc.id,
                ...cDoc.data(),
                universityId: uDoc.id
            });
        });
    }

    // 1. Header: X-Cafe-Id
    const headerCafeId = req.headers['x-cafe-id'];
    if (headerCafeId) {
        const cafe = allCafes.find(c => c.id === headerCafeId);
        if (cafe) {
            const university = universities.find(u => u.id === cafe.universityId);
            return { university, cafe };
        }
    }

    // 2. Header: X-University-Id
    const headerUniversityId = req.headers['x-university-id'];
    if (headerUniversityId) {
        const university = universities.find(u => u.id === headerUniversityId);
        if (university) {
            const cafe = allCafes.find(c => c.universityId === university.id) || null;
            return { university, cafe };
        }
    }

    // 3. user.lastActiveCafeId
    if (user.lastActiveCafeId) {
        const cafe = allCafes.find(c => c.id === user.lastActiveCafeId);
        if (cafe) {
            const university = universities.find(u => u.id === cafe.universityId);
            return { university, cafe };
        }
    }

    // 4. First owned café
    if (allCafes.length > 0) {
        const cafe = allCafes[0];
        const university = universities.find(u => u.id === cafe.universityId);
        return { university, cafe };
    }

    // Fallback: university but no café
    return { university: universities[0], cafe: null };
}

/**
 * Require Premium plan.
 */
function requirePremium(req, res, next) {
    if (!req.user || req.user.plan !== 'premium') {
        return res.status(403).json({
            success: false,
            error: 'Premium plan required',
            upgrade: true
        });
    }
    next();
}

/**
 * Require an active café.
 */
function requireCafe(req, res, next) {
    if (!req.user || !req.user.cafeId) {
        return res.status(400).json({
            success: false,
            error: 'No active cafeteria selected'
        });
    }
    next();
}

module.exports = {
    authenticate,
    requirePremium,
    requireCafe,
    resolveContext
};

