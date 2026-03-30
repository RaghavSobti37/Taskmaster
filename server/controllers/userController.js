import User from '../models/User.js';
import Task from '../models/Task.js';

// @desc    Get the current user's team with their tasks
// @route   GET /api/users/team
// @access  Private
export const getMyTeam = async (req, res) => {
    try {
        console.log('[GET_MY_TEAM] ===== REQUEST RECEIVED =====');
        console.log('[GET_MY_TEAM] User ID:', req.user?.id);
        
        const user = await User.findById(req.user.id).populate('team', 'username role').populate('circle', 'username');

        console.log('[GET_MY_TEAM] User found:', !!user);
        
        if (!user) {
            console.log('[GET_MY_TEAM] ❌ User not found');
            return res.status(404).json({ message: 'User not found' });
        }

        // Use team field if available, fallback to circle for backward compatibility
        const teamMembers = user.team && user.team.length > 0 ? user.team : user.circle;
        console.log('[GET_MY_TEAM] Team members count:', teamMembers?.length || 0);
        console.log('[GET_MY_TEAM] Team members:', teamMembers);

        // For each member in the team, fetch their visible, active tasks
        const teamWithTasks = await Promise.all(teamMembers.map(async (member) => {
            const tasks = await Task.find({
                assignee: member._id,
                isVisibleInCircle: true,
                status: { $ne: 'done' }
            }).limit(5).select('title status');

            return { ...member.toObject(), tasks };
        }));

        console.log('[GET_MY_TEAM] ✓ Sending response with', teamWithTasks.length, 'team members');
        res.json(teamWithTasks);
    } catch (error) {
        console.error('[GET_MY_TEAM] ❌ Error:', error.message);
        res.status(500).json({ message: 'Server Error', error: error.message });
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
        console.log('[SEARCH_USERS] ===== REQUEST RECEIVED =====');
        console.log('[SEARCH_USERS] Query:', req.query.q);
        
        const currentUser = await User.findById(req.user.id);
        const usersInTeam = currentUser.team && currentUser.team.length > 0 
            ? currentUser.team 
            : currentUser.circle;

        console.log('[SEARCH_USERS] Users in team:', usersInTeam?.length || 0);

        // Find users that match the keyword, are not the current user,
        // and are not already in the user's team.
        const users = await User.find({
            ...keyword,
            _id: { $ne: req.user.id, $nin: usersInTeam },
        })
        .limit(3) // Limit to top 3 results
        .select('id username'); // Only send back necessary info

        console.log('[SEARCH_USERS] Found', users.length, 'matching users');
        res.json(users);
    } catch (error) {
        console.error('[SEARCH_USERS] ❌ Error:', error.message);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Add a user to the team
// @route   POST /api/users/team
// @access  Private
export const addToTeam = async (req, res) => {
    const { userIdToAdd } = req.body;

    try {
        console.log('[ADD_TO_TEAM] ===== REQUEST RECEIVED =====');
        console.log('[ADD_TO_TEAM] Current user:', req.user?.id);
        console.log('[ADD_TO_TEAM] User to add:', userIdToAdd);
        
        const currentUser = await User.findById(req.user.id);

        // If this is the first team member being added, promote current user to lead
        if ((!currentUser.team || currentUser.team.length === 0) && 
            (!currentUser.circle || currentUser.circle.length === 0)) {
            console.log('[ADD_TO_TEAM] First team member - promoting to lead');
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

        console.log('[ADD_TO_TEAM] ✓ User added successfully');
        res.json(updatedUser.team);
    } catch (error) {
        console.error('[ADD_TO_TEAM] ❌ Error:', error.message);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get all users in the system
// @route   GET /api/users/all
// @access  Private
export const getAllUsers = async (req, res) => {
    try {
        console.log('[GET_ALL_USERS] ===== REQUEST RECEIVED =====');
        console.log('[GET_ALL_USERS] User ID making request:', req.user?.id);
        
        const users = await User.find().select('_id username email role profilePicture').lean();
        
        console.log('[GET_ALL_USERS] Found', users.length, 'users');
        console.log('[GET_ALL_USERS] Users:', users);
        console.log('[GET_ALL_USERS] Sending response...');
        
        res.json(users);
    } catch (error) {
        console.error('[GET_ALL_USERS] ❌ Error:', error.message);
        res.status(500).json({ message: 'Server Error', error: error.message });
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
