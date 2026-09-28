const { firestore } = require('../firebase');

function wasteRef(uid, universityId, cafeId) {
    return firestore.collection('users').doc(uid)
        .collection('universities').doc(universityId)
        .collection('cafes').doc(cafeId)
        .collection('waste');
}

async function list(uid, universityId, cafeId, { from, limit = 200 } = {}) {
    let q = wasteRef(uid, universityId, cafeId).orderBy('date', 'desc');
    if (from) q = q.where('date', '>=', from);
    q = q.limit(limit);
    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function create(uid, universityId, cafeId, data) {
    const ref = await wasteRef(uid, universityId, cafeId).add({
        ...data,
        createdAt: new Date()
    });
    return { id: ref.id, ...data };
}

async function remove(uid, universityId, cafeId, id) {
    await wasteRef(uid, universityId, cafeId).doc(id).delete();
}

async function inRange(uid, universityId, cafeId, from, to) {
    const snap = await wasteRef(uid, universityId, cafeId)
        .where('date', '>=', from)
        .where('date', '<=', to)
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

module.exports = { list, create, remove, inRange };
