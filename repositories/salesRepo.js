const { firestore } = require('../firebase');

function salesRef(uid, universityId, cafeId) {
    return firestore.collection('users').doc(uid)
        .collection('universities').doc(universityId)
        .collection('cafes').doc(cafeId)
        .collection('sales');
}

async function list(uid, universityId, cafeId, { limit = 100, offset = 0, from, to } = {}) {
    let q = salesRef(uid, universityId, cafeId).orderBy('date', 'desc');
    if (from) q = q.where('date', '>=', from);
    if (to) q = q.where('date', '<=', to);
    q = q.limit(limit);

    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function create(uid, universityId, cafeId, data) {
    const ref = await salesRef(uid, universityId, cafeId).add({
        ...data,
        createdAt: new Date()
    });
    return { id: ref.id, ...data };
}

async function remove(uid, universityId, cafeId, saleId) {
    const doc = await salesRef(uid, universityId, cafeId).doc(saleId).get();
    if (!doc.exists) return null;
    const sale = { id: doc.id, ...doc.data() };
    await salesRef(uid, universityId, cafeId).doc(saleId).delete();
    return sale;
}

async function salesInRange(uid, universityId, cafeId, from, to) {
    const snap = await salesRef(uid, universityId, cafeId)
        .where('date', '>=', from)
        .where('date', '<=', to)
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

module.exports = { list, create, remove, salesInRange };
