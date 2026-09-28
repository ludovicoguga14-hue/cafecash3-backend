/**
 * CafeCash Authentication Middleware
 * Firebase ID token verification + University + Café isolation
 */

const { admin, firestore } = require('../firebase');
const db = require('../config/db');

async function authenticate(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        console.error('AUTH: No Bearer token');
        return res.status(401).json({
            success: false,
            error: 'No token provided'
        });
    }

    const idToken = header.slice(7).trim();

    if (!idToken) {
        console.error('AUTH: Empty token');
        return res.status(401).json({
            success: false,
            error: 'Empty token'
        });
    }

    try {
        // Verify Firebase ID token.
        // Revocation check disabled temporarily so we can isolate
        // the source of the authentication problem.
        const decoded = await admin.auth().verifyIdToken(idToken);

        console.log('AUTH SUCCESS');
        console.log('Firebase UID:', decoded.uid);
        console.log('Firebase project:', decoded.aud);

        // Load user profile
        const userDoc = await firestore
            .collection('users')
            .doc(decoded.uid)
            .get();

        if (!userDoc.exists) {
            console.error(
                'AUTH: Firebase user exists but Firestore profile does not:',
                decoded.uid
            );

            return res.status(401).json({
                success: false,
                error: 'User profile not found'
            });
        }

        const user = {
            uid: decoded.uid,
            ...userDoc.data()
        };

        // Auto-downgrade expired premium
        if (user.plan === 'premium' && user.planExpiresAt) {
            const expiresAt = user.planExpiresAt.toDate
                ? user.planExpiresAt.toDate()
                : new Date(user.planExpiresAt);

            if (expiresAt < new Date()) {
                await firestore
                    .collection('users')
                    .doc(decoded.uid)
                    .update({
                        plan: 'basic',
                        planExpiresAt: null
                    });

                user.plan = 'basic';
                user.planExpiresAt = null;
            }
        }

        // Resolve active university + café
        const context = await resolveContext(
            decoded.uid,
            req,
            user
        );

        // Attach user context
        req.user = user;

        req.user.universityId =
            context.university?.id || null;

        req.user.university =
            context.university || null;

        req.user.cafeId =
            context.cafe?.id || null;

        req.user.activeCafe =
            context.cafe || null;

        req.user.timezone =
            context.cafe?.timezone ||
            'Africa/Johannesburg';

        req.user.role =
            context.role ||
            'manager';

        next();

    } catch (err) {

        console.error('════════ AUTH ERROR ════════');
        console.error('Code:', err.code);
        console.error('Message:', err.message);
        console.error('Name:', err.name);
        console.error('════════════════════════════');

        let status = 403;

        if (err.code === 'auth/id-token-expired') {
            status = 401;
        }

        if (err.code === 'auth/argument-error') {
            status = 401;
        }

        return res.status(status).json({
            success: false,
            error: err.message || 'Invalid or unauthorized token',
            code: err.code || 'unknown'
        });
    }
}


// ═══════════════════════════════════════════════════════════════
// RESOLVE UNIVERSITY + CAFÉ
// ═══════════════════════════════════════════════════════════════

async function resolveContext(uid, req, user) {

    const universitiesSnap =
        await firestore
            .collection('users')
            .doc(uid)
            .collection('universities')
            .get();

    let allCafes = [];
    const universities = [];

    for (const uDoc of universitiesSnap.docs) {

        const university = {
            id: uDoc.id,
            ...uDoc.data()
        };

        universities.push(university);

        const cafesSnap =
            await firestore
                .collection('users')
                .doc(uid)
                .collection('universities')
                .doc(uDoc.id)
                .collection('cafes')
                .get();

        cafesSnap.forEach(cDoc => {

            allCafes.push({
                id: cDoc.id,
                ...cDoc.data(),
                universityId: uDoc.id,
                universityName: university.name
            });

        });
    }

    // Café from request header
    const headerCafeId =
        req.headers['x-cafe-id'];

    if (headerCafeId) {

        const cafe =
            allCafes.find(
                c => c.id === headerCafeId
            );

        if (cafe) {

            const university =
                universities.find(
                    u => u.id === cafe.universityId
                );

            return {
                university,
                cafe,
                role: user.role || 'manager'
            };
        }
    }

    // University from request header
    const headerUniversityId =
        req.headers['x-university-id'];

    if (headerUniversityId) {

        const university =
            universities.find(
                u => u.id === headerUniversityId
            );

        if (university) {

            const cafe =
                allCafes.find(
                    c => c.universityId === university.id
                ) || null;

            return {
                university,
                cafe,
                role: user.role || 'manager'
            };
        }
    }

    // Last active café
    if (user.lastActiveCafeId) {

        const cafe =
            allCafes.find(
                c => c.id === user.lastActiveCafeId
            );

        if (cafe) {

            const university =
                universities.find(
                    u => u.id === cafe.universityId
                );

            return {
                university,
                cafe,
                role: user.role || 'manager'
            };
        }
    }

    // First available café
    if (allCafes.length) {

        const cafe = allCafes[0];

        const university =
            universities.find(
                u => u.id === cafe.universityId
            );

        return {
            university,
            cafe,
            role: user.role || 'manager'
        };
    }

    // University but no café
    return {
        university: universities[0] || null,
        cafe: null,
        role: user.role || 'manager'
    };
}


// ═══════════════════════════════════════════════════════════════
// PREMIUM
// ═══════════════════════════════════════════════════════════════

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


// ═══════════════════════════════════════════════════════════════
// CAFÉ REQUIRED
// ═══════════════════════════════════════════════════════════════

function requireCafe(req, res, next) {

    if (!req.user.cafeId) {

        return res.status(400).json({
            success: false,
            error: 'No active cafeteria selected'
        });
    }

    next();
}


// ═══════════════════════════════════════════════════════════════
// UNIVERSITY ADMIN
// ═══════════════════════════════════════════════════════════════

function requireUniversityAdmin(req, res, next) {

    if (
        !['admin', 'superadmin']
            .includes(req.user.role)
    ) {

        return res.status(403).json({
            success: false,
            error: 'University admin access required'
        });
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
