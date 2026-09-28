const { firestore } = require('../firebase');

function universitiesRef(uid) {
    return firestore.collection('users').doc(uid).collection('universities');
}

async function list(uid) {
    const snap = await universitiesRef(uid).orderBy('createdAt', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function get(uid, universityId) {
    const doc = await universitiesRef(uid).doc(universityId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function create(uid, data) {
    const ref = await universitiesRef(uid).add({
        name: data.name,
        code: data.code || null,
        country: data.country || 'South Africa',
        timezone: data.timezone || 'Africa/Johannesburg',
        currency: data.currency || 'ZAR',
        icon: data.icon || '🎓',
        address: data.address || null,
        createdAt: new Date()
    });
    return { id: ref.id, ...data };
}

async function update(uid, universityId, patch) {
    await universitiesRef(uid).doc(universityId).update({
        ...patch,
        updatedAt: new Date()
    });
    return get(uid, universityId);
}

async function remove(uid, universityId) {
    await firestore.recursiveDelete(universitiesRef(uid).doc(universityId));
}

async function ownsUniversity(uid, universityId) {
    const doc = await universitiesRef(uid).doc(universityId).get();
    return doc.exists;
}

module.exports = { list, get, create, update, remove, ownsUniversity };
