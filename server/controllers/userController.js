import User from '../models/User.js';
import Task from '../models/Task.js';

// @desc    Get the current user's team with their tasks
// @route   GET /api/users/team
// @access  Private
export const getMyTeam = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('team', 'username role').populate('circle', 'username');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Use team field if available, fallback to circle for backward compatibility
        const teamMembers = user.team && user.team.length > 0 ? user.team : user.circle;

        // For each member in the team, fetch their visible, active tasks
        const teamWithTasks = await Promise.all(teamMembers.map(async (member) => {
            const tasks = await Task.find({
                assignee: member._id,
                isVisibleInCircle: true,
                status: { $ne: 'done' }
            }).limit(5).select('title status');

            return { ...member.toObject(), tasks };
        }));

        res.json(teamWithTasks);
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
        const usersInTeam = currentUser.team && currentUser.team.length > 0 
            ? currentUser.team 
            : currentUser.circle;

        // Find users that match the keyword, are not the current user,
        // and are not already in the user's team.
        const users = await User.find({
            ...keyword,
            _id: { $ne: req.user.id, $nin: usersInTeam },
        })
        .limit(3) // Limit to top 3 results
        .select('id username'); // Only send back necessary info

        res.json(users);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Add a user to the team
// @route   POST /api/users/team
// @access  Private
export const addToTeam = async (req, res) => {
    const { userIdToAdd } = req.body;

    try {
        const currentUser = await User.findById(req.user.id);

        // If this is the first team member being added, promote current user to lead
        if ((!currentUser.team || currentUser.team.length === 0) && 
            (!currentUser.circle || currentUser.circle.length === 0)) {
            await User.findByIdAndUpdate(
                req.user.id,
                { role: 'lead' },
                { new: true }
            );
        }

        // Add the new user to the current user's team array
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $addToSet: { circle: userIdToAdd, team: userIdToAdd } }, // $addToSet prevents duplicates
            { new: true }
        ).populate('circle', 'username').populate('team', 'username');

        res.json(updatedUser.team);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get all users in the system
// @route   GET /api/users/all
// @access  Private
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('_id username email role profilePicture').lean();
        res.json(users);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Update user profile (username, password, profile picture)
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = async (req, res) => {
    const { username, currentPassword, newPassword, profilePicture } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update username if provided
        if (username) {
            const existingUser = await User.findOne({ username, _id: { $ne: req.user.id } });
            if (existingUser) {
                return res.status(400).json({ message: 'Username already taken' });
            }
            user.username = username;
        }

        // Update password if provided
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password required to change password' });
            }
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword, salt);
        }

        // Update profile picture if provided
        if (profilePicture !== undefined) {
            user.profilePicture = profilePicture;
        }

        await user.save();

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            profilePicture: user.profilePicture,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Legacy function names for backward compatibility
export const getMyCircle = getMyTeam;
export const addToCircle = addToTeam;
