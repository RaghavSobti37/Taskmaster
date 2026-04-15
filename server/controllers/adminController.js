import User from '../models/User.js';
import Task from '../models/Task.js';
import Log from '../models/Log.js';
import DailyLog from '../models/DailyLog.js';
import TaskLog from '../models/TaskLog.js';
import bcrypt from 'bcryptjs';

const normalizeDateString = (inputDate) => {
    if (!inputDate) {
        return new Date().toISOString().split('T')[0];
    }

    const date = new Date(inputDate);
    if (Number.isNaN(date.getTime())) {
        return new Date().toISOString().split('T')[0];
    }

    return date.toISOString().split('T')[0];
};

const buildTaskKeywordSummary = (tasks = []) => {
    const stopWords = new Set([
        'and', 'for', 'the', 'with', 'from', 'this', 'that', 'into', 'onto',
        'task', 'tasks', 'work', 'worked', 'doing', 'done', 'update', 'updated',
        'issue', 'issues', 'bug', 'bugs', 'fix', 'fixed', 'in', 'on', 'of', 'to',
        'a', 'an', 'at', 'is', 'are', 'was', 'were', 'it', 'by', 'or', 'as'
    ]);

    const keywords = new Map();

    tasks.forEach((task) => {
        const text = `${task.taskTitle || ''} ${task.description || ''}`.toLowerCase();
        text
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((word) => word.length > 2 && !stopWords.has(word))
            .forEach((word) => {
                keywords.set(word, (keywords.get(word) || 0) + 1);
            });
    });

    return Array.from(keywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([keyword, count]) => ({ keyword, count }));
};

const buildActivityNarrative = ({
    username,
    periodLabel,
    totalHours,
    totalTasks,
    completedTasks,
    statusBreakdown,
    topKeywords,
    totalDays,
    mostActiveDay
}) => {
    const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0.0';
    const primaryFocus = topKeywords.length > 0
        ? topKeywords.slice(0, 4).map((entry) => entry.keyword).join(', ')
        : 'general task execution and updates';

    const breakdownText = Object.entries(statusBreakdown)
        .map(([status, count]) => `${status.replace('_', ' ')}: ${count}`)
        .join(', ');

    return `${username} logged ${totalTasks} tasks and ${totalHours.toFixed(1)} total hours over ${totalDays} logged day(s) in ${periodLabel}. ` +
        `Completion rate was ${completionRate}%. Primary focus areas: ${primaryFocus}. ` +
        `Status distribution: ${breakdownText || 'no status data'}. ` +
        `${mostActiveDay ? `Most active day: ${mostActiveDay.date} (${mostActiveDay.totalHours.toFixed(1)}h).` : 'No standout active day yet.'}`;
};

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
            .select('_id username email role createdAt lastLogin loginCount team circle')
            .lean();

        const linkedByUserId = new Map();

        users.forEach((user) => {
            const userId = user._id.toString();

            if (!linkedByUserId.has(userId)) {
                linkedByUserId.set(userId, new Set());
            }

            const relatedIds = [
                ...(user.team || []).map((id) => id.toString()),
                ...(user.circle || []).map((id) => id.toString())
            ];

            relatedIds.forEach((memberId) => {
                if (!linkedByUserId.has(memberId)) {
                    linkedByUserId.set(memberId, new Set());
                }

                linkedByUserId.get(memberId).add(userId);
            });
        });

        // Get task counts for each user
        const usersWithStats = await Promise.all(users.map(async (user) => {
            const taskCount = await Task.countDocuments({ creator: user._id });
            const userId = user._id.toString();
            const uniqueTeamIds = new Set([
                ...(user.team || []).map((id) => id.toString()),
                ...(user.circle || []).map((id) => id.toString())
            ]);

            const inboundLinks = linkedByUserId.get(userId) || new Set();
            inboundLinks.forEach((linkedUserId) => uniqueTeamIds.add(linkedUserId));
            uniqueTeamIds.delete(userId);
            
            return {
                ...user,
                taskCount,
                teamCount: uniqueTeamIds.size,
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
        const { limit = 30, fromDate, toDate, search = '' } = req.query;

        const query = { userId };

        if (fromDate || toDate) {
            query.date = {};
            if (fromDate) {
                query.date.$gte = normalizeDateString(fromDate);
            }
            if (toDate) {
                query.date.$lte = normalizeDateString(toDate);
            }
        }

        const trimmedSearch = search.trim();
        if (trimmedSearch) {
            query.$or = [
                { notes: { $regex: trimmedSearch, $options: 'i' } },
                { 'tasks.taskTitle': { $regex: trimmedSearch, $options: 'i' } },
                { 'tasks.description': { $regex: trimmedSearch, $options: 'i' } }
            ];
        }

        const dailyLogs = await TaskLog.find(query)
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
        const { date, limit = 500 } = req.query;
        const normalizedDate = normalizeDateString(date);

        const dailyLogs = await TaskLog.find({ date: normalizedDate })
            .populate('userId', 'username email')
            .sort({ date: -1 })
            .limit(parseInt(limit))
            .lean();

        res.json({
            date: normalizedDate,
            totalLogs: dailyLogs.length,
            logs: dailyLogs
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get a user's progress report for a period
// @route   GET /api/admin/users/:userId/progress-report
// @access  Private (Admin only)
export const getUserProgressReport = async (req, res) => {
    try {
        const { userId } = req.params;
        const { range = '7' } = req.query;

        const user = await User.findById(userId).select('_id username email');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const query = { userId };
        let periodLabel = 'all time';

        if (range !== 'all') {
            const parsedRange = parseInt(range, 10);
            if (Number.isNaN(parsedRange) || parsedRange <= 0) {
                return res.status(400).json({ message: 'Invalid range value' });
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parsedRange + 1);
            query.date = { $gte: startDate.toISOString().split('T')[0] };
            periodLabel = `last ${parsedRange} day(s)`;
        }

        const logs = await TaskLog.find(query).sort({ date: -1 }).lean();

        const flattenedTasks = logs.flatMap((log) => log.tasks || []);
        const totalHours = logs.reduce((sum, log) => sum + (log.totalHours || 0), 0);
        const totalTasks = flattenedTasks.length;
        const completedTasks = flattenedTasks.filter((task) => task.status === 'completed').length;
        const inProgressTasks = flattenedTasks.filter((task) => task.status === 'in_progress').length;
        const blockedTasks = flattenedTasks.filter((task) => task.status === 'blocked').length;
        const pendingTasks = flattenedTasks.filter((task) => task.status === 'pending').length;

        const mostActiveDay = logs.reduce((best, log) => {
            if (!best || (log.totalHours || 0) > (best.totalHours || 0)) {
                return log;
            }
            return best;
        }, null);

        const topKeywords = buildTaskKeywordSummary(flattenedTasks);

        const statusBreakdown = {
            completed: completedTasks,
            in_progress: inProgressTasks,
            blocked: blockedTasks,
            pending: pendingTasks
        };

        const report = {
            user: {
                _id: user._id,
                username: user.username,
                email: user.email
            },
            period: {
                range,
                label: periodLabel
            },
            metrics: {
                totalLoggedDays: logs.length,
                totalHours,
                totalTasks,
                completedTasks,
                inProgressTasks,
                blockedTasks,
                pendingTasks,
                completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
                averageHoursPerLoggedDay: logs.length > 0 ? totalHours / logs.length : 0,
                averageTasksPerLoggedDay: logs.length > 0 ? totalTasks / logs.length : 0,
                mostActiveDay: mostActiveDay
                    ? {
                        date: mostActiveDay.date,
                        totalHours: mostActiveDay.totalHours || 0,
                        totalTasks: (mostActiveDay.tasks || []).length
                    }
                    : null
            },
            topFocusAreas: topKeywords,
            summary: buildActivityNarrative({
                username: user.username,
                periodLabel,
                totalHours,
                totalTasks,
                completedTasks,
                statusBreakdown,
                topKeywords,
                totalDays: logs.length,
                mostActiveDay: mostActiveDay
                    ? {
                        date: mostActiveDay.date,
                        totalHours: mostActiveDay.totalHours || 0
                    }
                    : null
            }),
            recentLogs: logs.slice(0, 10)
        };

        res.json(report);
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
