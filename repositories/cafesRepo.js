const { firestore } = require('../firebase');

function cafesRef(uid, universityId) {
    return firestore.collection('users').doc(uid)
        .collection('universities').doc(universityId)
        .collection('cafes');
}

async function list(uid, universityId) {
    const snap = await cafesRef(uid, universityId).orderBy('createdAt', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function listAll(uid) {
    // Fetch all cafés across all universities owned by user
    const universities = await firestore.collection('users').doc(uid)
        .collection('universities').get();

    const all = [];
    for (const uDoc of universities.docs) {
        const cafes = await list(uid, uDoc.id);
        cafes.forEach(c => {
            all.push({
                ...c,
                universityId: uDoc.id,
                universityName: uDoc.data().name
            });
        });
    }
    return all;
}

async function get(uid, universityId, cafeId) {
    const doc = await cafesRef(uid, universityId).doc(cafeId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function create(uid, universityId, data) {
    const ref = await cafesRef(uid, universityId).add({
        name: data.name,
        type: data.type || 'cafeteria',
        campus: data.campus || null,
        timezone: data.timezone || 'Africa/Johannesburg',
        currency: data.currency || 'ZAR',
        icon: data.icon || '🍽️',
        address: data.address || null,
        isActive: false,
        createdAt: new Date()
    });
    return { id: ref.id, ...data };
}

async function update(uid, universityId, cafeId, patch) {
    await cafesRef(uid, universityId).doc(cafeId).update({
        ...patch,
        updatedAt: new Date()
    });
    return get(uid, universityId, cafeId);
}

async function remove(uid, universityId, cafeId) {
    await firestore.recursiveDelete(cafesRef(uid, universityId).doc(cafeId));
}

async function ownsCafe(uid, cafeId) {
    const all = await listAll(uid);
    return all.find(c => c.id === cafeId) || null;
}

async function setActive(uid, cafeId) {
    // Update user's lastActiveCafeId (café-level is derived)
    await firestore.collection('users').doc(uid).update({
        lastActiveCafeId: cafeId
    });

    const cafe = await ownsCafe(uid, cafeId);
    return cafe;
}

module.exports = { list, listAll, get, create, update, remove, ownsCafe, setActive };
