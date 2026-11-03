const auth = (req, res, next) => {
    if (req.session && req.session.userId) {
        req.user = {
            id: req.session.userId,
            role: req.session.role,
            permissions: Array.isArray(req.session.permissions) ? req.session.permissions : []
        };
        next();
    } else {
        res.status(401).json({ message: 'No session, authorization denied' });
    }
};
module.exports = auth;
