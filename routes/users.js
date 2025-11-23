const express = require('express');
const router = express.Router();
const Angeluser = require('../models/Angeluser');
const MOUser = require('../models/MOUser');
const DhanUser = require('../models/DhanUser');
const ShareKhanUser = require('../models/ShareKhanUser');
const IIFLUser = require('../models/IIFLUser');

// Get all Angel users
router.get('/angel', async (req, res) => {
    try {
        const users = await Angeluser.find({}, {
            password: 0, // Exclude password from response
            totpKey: 0   // Exclude TOTP key from response
        }).sort({ createdAt: -1 });

        res.json(users);
    } catch (error) {
        console.error('Error fetching Angel users:', error);
        res.status(500).json({ error: 'Failed to fetch Angel users' });
    }
});

// Get all Motilal users
router.get('/motilal', async (req, res) => {
    try {
        const users = await MOUser.find({}, {
            password: 0, // Exclude password from response
            totpKey: 0   // Exclude TOTP key from response
        }).sort({ createdAt: -1 });

        res.json(users);
    } catch (error) {
        console.error('Error fetching Motilal users:', error);
        res.status(500).json({ error: 'Failed to fetch Motilal users' });
    }
});

// Get all Dhan users
router.get('/dhan', async (req, res) => {
    try {
        const users = await DhanUser.find({}, {
            jwtToken: 0 // Exclude JWT token from response for security
        }).sort({ createdAt: -1 });

        res.json(users);
    } catch (error) {
        console.error('Error fetching Dhan users:', error);
        res.status(500).json({ error: 'Failed to fetch Dhan users' });
    }
});

// Get all ShareKhan users
router.get('/sharekhan', async (req, res) => {
    try {
        const users = await ShareKhanUser.find({}, {
            accessToken: 0, // Exclude access token from response for security
            apiKey: 0       // Exclude API key from response for security
        }).sort({ createdAt: -1 });

        res.json(users);
    } catch (error) {
        console.error('Error fetching ShareKhan users:', error);
        res.status(500).json({ error: 'Failed to fetch ShareKhan users' });
    }
});

// Get all IIFL users
router.get('/iifl', async (req, res) => {
    try {
        const users = await IIFLUser.find({}, {
            token: 0, // Exclude session token from response for security
            secretKey: 0 // Exclude secret key from response for security
        }).sort({ createdAt: -1 });

        res.json(users);
    } catch (error) {
        console.error('Error fetching IIFL users:', error);
        res.status(500).json({ error: 'Failed to fetch IIFL users' });
    }
});

// Get user by ID
router.get('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        let user;

        if (type === 'angel') {
            user = await Angeluser.findById(id, {
                password: 0,
                totpKey: 0
            });
        } else if (type === 'motilal') {
            user = await MOUser.findById(id, {
                password: 0,
                totpKey: 0
            });
        } else if (type === 'dhan') {
            user = await DhanUser.findById(id, {
                jwtToken: 0
            });
        } else if (type === 'sharekhan') {
            user = await ShareKhanUser.findById(id, {
                accessToken: 0,
                apiKey: 0
            });
        } else if (type === 'iifl') {
            user = await IIFLUser.findById(id, {
                token: 0,
                secretKey: 0
            });
        } else {
            return res.status(400).json({ error: 'Invalid user type' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// Update user
router.put('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const updateData = req.body;

        // Remove sensitive fields from update data
        delete updateData.password;
        delete updateData.totpKey;
        delete updateData.jwtToken; // Remove JWT token for Dhan users

        let user;
        if (type === 'angel') {
            user = await Angeluser.findByIdAndUpdate(id, updateData, {
                new: true,
                select: '-password -totpKey'
            });
        } else if (type === 'motilal') {
            user = await MOUser.findByIdAndUpdate(id, updateData, {
                new: true,
                select: '-password -totpKey'
            });
        } else if (type === 'dhan') {
            user = await DhanUser.findByIdAndUpdate(id, updateData, {
                new: true,
                select: '-jwtToken'
            });
        } else {
            return res.status(400).json({ error: 'Invalid user type' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        let user;

        if (type === 'angel') {
            user = await Angeluser.findByIdAndDelete(id);
        } else if (type === 'motilal') {
            user = await MOUser.findByIdAndDelete(id);
        } else if (type === 'dhan') {
            user = await DhanUser.findByIdAndDelete(id);
        } else {
            return res.status(400).json({ error: 'Invalid user type' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Toggle user status (activate/deactivate)
router.patch('/:type/:id/status', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { active } = req.body;

        let user;
        const updateData = {};

        if (type === 'angel') {
            // For Angel users, we can use a status field or clear tokens
            updateData.state = active ? 'live' : 'inactive';
            user = await Angeluser.findByIdAndUpdate(id, updateData, {
                new: true,
                select: '-password -totpKey'
            });
        } else if (type === 'motilal') {
            // For Motilal users, we can add a status field
            updateData.status = active ? 'active' : 'inactive';
            user = await MOUser.findByIdAndUpdate(id, updateData, {
                new: true,
                select: '-password -totpKey'
            });
        } else if (type === 'dhan') {
            // For Dhan users, use state field like Angel
            updateData.state = active ? 'live' : 'inactive';
            user = await DhanUser.findByIdAndUpdate(id, updateData, {
                new: true,
                select: '-jwtToken'
            });
        } else {
            return res.status(400).json({ error: 'Invalid user type' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ 
            message: `User ${active ? 'activated' : 'deactivated'} successfully`, 
            user 
        });
    } catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ error: 'Failed to toggle user status' });
    }
});

// Get user statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const [angelUsers, motilalUsers, dhanUsers, shareKhanUsers, iiflUsers] = await Promise.all([
            Angeluser.countDocuments({}),
            MOUser.countDocuments({}),
            DhanUser.countDocuments({}),
            ShareKhanUser.countDocuments({}),
            IIFLUser.countDocuments({})
        ]);

        const [activeAngelUsers, activeMotilalUsers, activeDhanUsers, activeShareKhanUsers, activeIIFLUsers] = await Promise.all([
            Angeluser.countDocuments({
                jwtToken: { $exists: true, $ne: null },
                state: { $ne: 'inactive' }
            }),
            MOUser.countDocuments({
                authToken: { $exists: true, $ne: null },
                status: { $ne: 'inactive' }
            }),
            DhanUser.countDocuments({
                jwtToken: { $exists: true, $ne: null },
                state: { $ne: 'inactive' }
            }),
            ShareKhanUser.countDocuments({
                accessToken: { $exists: true, $ne: null },
                state: { $ne: 'inactive' }
            }),
            IIFLUser.countDocuments({
                token: { $exists: true, $ne: null },
                state: { $ne: 'inactive' }
            })
        ]);

        // Get capital statistics
        const [angelCapitalStats, motilalCapitalStats, dhanCapitalStats, shareKhanCapitalStats, iiflCapitalStats] = await Promise.all([
            Angeluser.aggregate([
                {
                    $group: {
                        _id: null,
                        totalCapital: { $sum: '$capital' },
                        avgCapital: { $avg: '$capital' },
                        maxCapital: { $max: '$capital' },
                        minCapital: { $min: '$capital' }
                    }
                }
            ]),
            MOUser.aggregate([
                {
                    $group: {
                        _id: null,
                        totalCapital: { $sum: '$capital' },
                        avgCapital: { $avg: '$capital' },
                        maxCapital: { $max: '$capital' },
                        minCapital: { $min: '$capital' }
                    }
                }
            ]),
            DhanUser.aggregate([
                {
                    $group: {
                        _id: null,
                        totalCapital: { $sum: '$capital' },
                        avgCapital: { $avg: '$capital' },
                        maxCapital: { $max: '$capital' },
                        minCapital: { $min: '$capital' }
                    }
                }
            ]),
            ShareKhanUser.aggregate([
                {
                    $group: {
                        _id: null,
                        totalCapital: { $sum: '$capital' },
                        avgCapital: { $avg: '$capital' },
                        maxCapital: { $max: '$capital' },
                        minCapital: { $min: '$capital' }
                    }
                }
            ]),
            IIFLUser.aggregate([
                {
                    $group: {
                        _id: null,
                        totalCapital: { $sum: '$capital' },
                        avgCapital: { $avg: '$capital' },
                        maxCapital: { $max: '$capital' },
                        minCapital: { $min: '$capital' }
                    }
                }
            ])
        ]);

        const stats = {
            totalUsers: angelUsers + motilalUsers + dhanUsers + shareKhanUsers + iiflUsers,
            angelUsers,
            motilalUsers,
            dhanUsers,
            shareKhanUsers,
            iiflUsers,
            activeUsers: activeAngelUsers + activeMotilalUsers + activeDhanUsers + activeShareKhanUsers + activeIIFLUsers,
            activeAngelUsers,
            activeMotilalUsers,
            activeDhanUsers,
            activeShareKhanUsers,
            activeIIFLUsers,
            capitalStats: {
                angel: angelCapitalStats[0] || { totalCapital: 0, avgCapital: 0, maxCapital: 0, minCapital: 0 },
                motilal: motilalCapitalStats[0] || { totalCapital: 0, avgCapital: 0, maxCapital: 0, minCapital: 0 },
                dhan: dhanCapitalStats[0] || { totalCapital: 0, avgCapital: 0, maxCapital: 0, minCapital: 0 },
                sharekhan: shareKhanCapitalStats[0] || { totalCapital: 0, avgCapital: 0, maxCapital: 0, minCapital: 0 },
                iifl: iiflCapitalStats[0] || { totalCapital: 0, avgCapital: 0, maxCapital: 0, minCapital: 0 }
            }
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching user statistics:', error);
        res.status(500).json({ error: 'Failed to fetch user statistics' });
    }
});

// Get recent user activities
router.get('/activities/recent', async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const [recentAngelUsers, recentMotilalUsers] = await Promise.all([
            Angeluser.find({}, {
                clientName: 1,
                userId: 1,
                createdAt: 1,
                updatedAt: 1,
                state: 1
            }).sort({ updatedAt: -1 }).limit(parseInt(limit) / 2),
            
            MOUser.find({}, {
                clientName: 1,
                userId: 1,
                createdAt: 1,
                updatedAt: 1,
                status: 1
            }).sort({ updatedAt: -1 }).limit(parseInt(limit) / 2)
        ]);

        const activities = [
            ...recentAngelUsers.map(user => ({
                ...user.toObject(),
                broker: 'ANGEL',
                type: 'angel'
            })),
            ...recentMotilalUsers.map(user => ({
                ...user.toObject(),
                broker: 'MOTILAL',
                type: 'motilal'
            }))
        ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        res.json(activities);
    } catch (error) {
        console.error('Error fetching user activities:', error);
        res.status(500).json({ error: 'Failed to fetch user activities' });
    }
});

// Bulk operations
router.post('/bulk/activate', async (req, res) => {
    try {
        const { userIds, type } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'User IDs array is required' });
        }

        let result;
        if (type === 'angel') {
            result = await Angeluser.updateMany(
                { _id: { $in: userIds } },
                { state: 'live' }
            );
        } else if (type === 'motilal') {
            result = await MOUser.updateMany(
                { _id: { $in: userIds } },
                { status: 'active' }
            );
        } else {
            return res.status(400).json({ error: 'Invalid user type' });
        }

        res.json({ 
            message: `${result.modifiedCount} users activated successfully`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error bulk activating users:', error);
        res.status(500).json({ error: 'Failed to activate users' });
    }
});

router.post('/bulk/deactivate', async (req, res) => {
    try {
        const { userIds, type } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'User IDs array is required' });
        }

        let result;
        if (type === 'angel') {
            result = await Angeluser.updateMany(
                { _id: { $in: userIds } },
                { state: 'inactive' }
            );
        } else if (type === 'motilal') {
            result = await MOUser.updateMany(
                { _id: { $in: userIds } },
                { status: 'inactive' }
            );
        } else {
            return res.status(400).json({ error: 'Invalid user type' });
        }

        res.json({ 
            message: `${result.modifiedCount} users deactivated successfully`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error bulk deactivating users:', error);
        res.status(500).json({ error: 'Failed to deactivate users' });
    }
});

module.exports = router;
