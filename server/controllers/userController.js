import User from '../models/User.js';
import Task from '../models/Task.js';

// @desc    Get the current user's circle with their tasks
// @route   GET /api/users/circle
// @access  Private
export const getMyCircle = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('circle', 'username');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // For each member in the circle, fetch their visible, active tasks
        const circleWithTasks = await Promise.all(user.circle.map(async (member) => {
            const tasks = await Task.find({
                assignee: member._id,
                isVisibleInCircle: true,
                status: { $ne: 'done' }
            }).limit(5).select('title status');

            return { ...member.toObject(), tasks };
        }));

        res.json(circleWithTasks);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Search for users by username
// @route   GET /api/users/search
// @access  Private
export const searchUsers = async (req, res) => {
    const keyword = req.query.q
        ? {
            username: {
                $regex: req.query.q,
                $options: 'i', // Case-insensitive
            },
        }
        : {};

    try {
        const currentUser = await User.findById(req.user.id);
        const usersInCircle = currentUser.circle;

        // Find users that match the keyword, are not the current user,
        // and are not already in the user's circle.
        const users = await User.find({
            ...keyword,
            _id: { $ne: req.user.id, $nin: usersInCircle },
        })
        .limit(3) // Limit to top 3 results
        .select('id username'); // Only send back necessary info

        res.json(users);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Add a user to the circle
// @route   POST /api/users/circle
// @access  Private
export const addToCircle = async (req, res) => {
    const { userIdToAdd } = req.body;

    try {
        // Add the new user to the current user's circle array
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $addToSet: { circle: userIdToAdd } }, // $addToSet prevents duplicates
            { new: true }
        ).populate('circle', 'username');

        res.json(updatedUser.circle);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};