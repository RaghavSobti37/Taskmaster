import User from '../models/User.js';

// @desc    Verify user is an admin
// @access  Private (Admin only)
export const adminOnly = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role !== 'admin' && user.role !== 'server_admin') {
            return res.status(403).json({ message: 'Access denied. Admin or server admin privileges required.' });
        }

        next();
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

export default adminOnly;
