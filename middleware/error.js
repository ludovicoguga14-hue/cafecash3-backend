function errorHandler(err, req, res, next) {
    console.error('❌ Error:', {
        message: err.message,
        path: req.path,
        method: req.method,
        uid: req.user?.uid,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });

    if (err.code === 'permission-denied') {
        return res.status(403).json({ success: false, error: 'Permission denied' });
    }

    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
}

function notFound(req, res) {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
}

module.exports = { errorHandler, notFound };
