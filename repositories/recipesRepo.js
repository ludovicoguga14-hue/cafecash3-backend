const { firestore } = require('../firebase');

function recipesRef(uid, universityId, cafeId) {
    return firestore.collection('users').doc(uid)
        .collection('universities').doc(universityId)
        .collection('cafes').doc(cafeId)
        .collection('recipes');
}

async function list(uid, universityId, cafeId) {
    const snap = await recipesRef(uid, universityId, cafeId).orderBy('name').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function get(uid, universityId, cafeId, id) {
    const doc = await recipesRef(uid, universityId, cafeId).doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function create(uid, universityId, cafeId, data) {
    const ref = await recipesRef(uid, universityId, cafeId).add({
        ...data,
        ingredients: data.ingredients || [],
        createdAt: new Date(),
        updatedAt: new Date()
    });
    return get(uid, universityId, cafeId, ref.id);
}

async function update(uid, universityId, cafeId, id, patch) {
    await recipesRef(uid, universityId, cafeId).doc(id).update({
        ...patch,
        updatedAt: new Date()
    });
    return get(uid, universityId, cafeId, id);
}

async function remove(uid, universityId, cafeId, id) {
    await recipesRef(uid, universityId, cafeId).doc(id).delete();
}

module.exports = { list, get, create, update, remove };
