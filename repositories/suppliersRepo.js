const { firestore } = require('../firebase');

function suppliersRef(uid, universityId, cafeId) {
    return firestore.collection('users').doc(uid)
        .collection('universities').doc(universityId)
        .collection('cafes').doc(cafeId)
        .collection('suppliers');
}

async function list(uid, universityId, cafeId) {
    const snap = await suppliersRef(uid, universityId, cafeId).orderBy('name').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function create(uid, universityId, cafeId, data) {
    const ref = await suppliersRef(uid, universityId, cafeId).add({
        ...data,
        createdAt: new Date()
    });
    return { id: ref.id, ...data };
}

async function remove(uid, universityId, cafeId, id) {
    await firestore.recursiveDelete(suppliersRef(uid, universityId, cafeId).doc(id));
}

async function ledgerList(uid, universityId, cafeId, supplierId) {
    const snap = await suppliersRef(uid, universityId, cafeId)
        .doc(supplierId).collection('ledger').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function ledgerCreate(uid, universityId, cafeId, supplierId, data) {
    const ref = await suppliersRef(uid, universityId, cafeId)
        .doc(supplierId).collection('ledger').add({
            ...data,
            createdAt: new Date()
        });
    return { id: ref.id, ...data };
}

module.exports = { list, create, remove, ledgerList, ledgerCreate };
