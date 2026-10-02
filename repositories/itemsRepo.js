const { firestore } = require('../firebase');

function itemsRef(uid, universityId, cafeId) {
    return firestore.collection('users').doc(uid)
        .collection('universities').doc(universityId)
        .collection('cafes').doc(cafeId)
        .collection('items');
}

async function list(uid, universityId, cafeId) {
    const snap = await itemsRef(uid, universityId, cafeId).orderBy('name').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function get(uid, universityId, cafeId, itemId) {
    const doc = await itemsRef(uid, universityId, cafeId).doc(itemId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function create(uid, universityId, cafeId, data) {
    const ref = await itemsRef(uid, universityId, cafeId).add({
        name: data.name,
        sku: data.sku || null,
        category: data.category || 'Other',
        icon: data.icon || '📦',
        cost: Number(data.cost) || 0,
        price: Number(data.price) || 0,
        qty: parseInt(data.qty) || 0,
        lowStockThreshold: parseInt(data.lowStockThreshold) || 5,
        expiryDate: data.expiryDate || null,
        supplierId: data.supplierId || null,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    return get(uid, universityId, cafeId, ref.id);
}

async function update(uid, universityId, cafeId, itemId, patch) {
    const clean = {};
    const allowed = ['name', 'sku', 'category', 'icon', 'cost', 'price',
                     'qty', 'lowStockThreshold', 'expiryDate', 'supplierId'];
    for (const k of allowed) {
        if (k in patch) clean[k] = patch[k];
    }
    clean.updatedAt = new Date();

    await itemsRef(uid, universityId, cafeId).doc(itemId).update(clean);
    return get(uid, universityId, cafeId, itemId);
}

async function remove(uid, universityId, cafeId, itemId) {
    await itemsRef(uid, universityId, cafeId).doc(itemId).delete();
}

async function decrementStock(uid, universityId, cafeId, itemId, qty) {
    const { FieldValue } = require('firebase-admin').firestore;
    await itemsRef(uid, universityId, cafeId).doc(itemId).update({
        qty: FieldValue.increment(-qty),
        updatedAt: new Date()
    });
}

async function incrementStock(uid, universityId, cafeId, itemId, qty) {
    const { FieldValue } = require('firebase-admin').firestore;
    await itemsRef(uid, universityId, cafeId).doc(itemId).update({
        qty: FieldValue.increment(qty),
        updatedAt: new Date()
    });
}

async function count(uid, universityId, cafeId) {
    const snap = await itemsRef(uid, universityId, cafeId).count().get();
    return snap.data().count;
}

module.exports = {
    list, get, create, update, remove,
    decrementStock, incrementStock, count
};
