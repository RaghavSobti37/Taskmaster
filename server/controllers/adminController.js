import User from '../models/User.js';
import Task from '../models/Task.js';
import Log from '../models/Log.js';
import DailyLog from '../models/DailyLog.js';
import bcrypt from 'bcryptjs';

// @desc    Get all server logs
// @route   GET /api/admin/logs
// @access  Private (Admin only)
export const getLogs = async (req, res) => {
    try {
        const logs = await Log.find()
            .sort({ timestamp: -1 })
            .limit(500)
            .lean();

        res.json(logs);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Clear all server logs
// @route   DELETE /api/admin/logs
// @access  Private (Admin only)
export const clearLogs = async (req, res) => {
    try {
        await Log.deleteMany({});
        res.json({ message: 'All logs cleared' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get all users with stats
// @route   GET /api/admin/users
// @access  Private (Admin only)
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('_id username email role createdAt lastLogin loginCount')
            .lean();

        // Get task counts for each user
        const usersWithStats = await Promise.all(users.map(async (user) => {
            const taskCount = await Task.countDocuments({ creator: user._id });
            const teamCount = await User.findById(user._id).select('team');
            
            return {
                ...user,
                taskCount,
                teamCount: teamCount?.team?.length || 0,
            };
        }));

        res.json(usersWithStats);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get server statistics
// @route   GET /api/admin/stats
// @access  Private (Admin only)
export const getStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalTasks = await Task.countDocuments();
        const completedTasks = await Task.countDocuments({ status: 'done' });
        
        // Get active users in last 24 hours (users who have tasks with recent updates)
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const activeUsersLast24h = await Task.distinct('creator', {
            updatedAt: { $gte: last24h }
        }).then(arr => arr.length);

        const stats = {
            totalUsers,
            totalTasks,
            completedTasks,
            activeUsersLast24h,
            completionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0,
        };

        res.json(stats);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Delete a user
// @route   DELETE /api/admin/users/:userId
// @access  Private (Admin only)
export const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Prevent deleting the current user
        if (userId === req.user.id) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prevent deletion of admin users
        if (user.role === 'admin') {
            return res.status(403).json({ message: 'Cannot delete admin accounts' });
        }

        // Delete user's tasks
        await Task.deleteMany({ creator: userId });

        // Remove user from all team arrays
        await User.updateMany(
            { team: userId },
            { $pull: { team: userId, circle: userId } }
        );

        // Delete the user
        await User.findByIdAndDelete(userId);

        res.json({ message: `User ${user.username} has been deleted` });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Promote user to admin
// @route   PATCH /api/admin/users/:userId/promote
// @access  Private (Admin only)
export const promoteToAdmin = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findByIdAndUpdate(
            userId,
            { role: 'admin' },
            { new: true }
        ).select('_id username email role');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: `${user.username} has been promoted to admin`, user });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Disable/Enable a user account
// @route   PATCH /api/admin/users/:userId/toggle-disable
// @access  Private (Admin only)
export const toggleUserDisable = async (req, res) => {
    try {
        const { userId } = req.params;

        if (userId === req.user.id) {
            return res.status(400).json({ message: 'Cannot disable your own account' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.isDisabled = !user.isDisabled;
        await user.save();

        res.json({ 
            message: `User ${user.username} has been ${user.isDisabled ? 'disabled' : 'enabled'}`, 
            user: { _id: user._id, username: user.username, isDisabled: user.isDisabled }
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Change user password (admin function)
// @route   PATCH /api/admin/users/:userId/change-password
// @access  Private (Admin only)
export const changeUserPassword = async (req, res) => {
    try {
        const { userId } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: `Password for ${user.username} has been changed` });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get user login history
// @route   GET /api/admin/users/:userId/login-history
// @access  Private (Admin only)
export const getUserLoginHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = req.query.limit || 50;

        const user = await User.findById(userId).select('loginHistory lastLogin');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            userId,
            lastLogin: user.lastLogin,
            totalLogins: user.loginCount,
            loginHistory: user.loginHistory?.slice(-limit) || []
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get daily logs for a user
// @route   GET /api/admin/users/:userId/daily-logs
// @access  Private (Admin only)
export const getUserDailyLogs = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 30 } = req.query;

        const dailyLogs = await DailyLog.find({ userId })
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json(dailyLogs);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get all daily logs (system-wide)
// @route   GET /api/admin/daily-logs
// @access  Private (Admin only)
export const getAllDailyLogs = async (req, res) => {
    try {
        const { days = 7, limit = 500 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        const dailyLogs = await DailyLog.find({ date: { $gte: startDate } })
            .populate('userId', 'username email')
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json(dailyLogs);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Assign server admin role
// @route   PATCH /api/admin/users/:userId/make-server-admin
// @access  Private (Server Admin only)
export const makeServerAdmin = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findByIdAndUpdate(
            userId,
            { role: 'server_admin' },
            { new: true }
        ).select('_id username email role');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: `${user.username} is now a server admin`, user });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
