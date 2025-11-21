const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

// Get all IIFL users
router.get('/iifl', async (req, res) => {
    try {
        const users = await prisma.iIFLUser.findMany({ orderBy: { createdAt: 'desc' } });
        const sanitized = users.map(({ token, totpSecret, ...rest }) => rest);
        res.json(sanitized);
    } catch (error) {
        console.error('Error fetching IIFL users:', error);
        res.status(500).json({ error: 'Failed to fetch IIFL users' });
    }
});

// Get user by ID
router.get('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        if (type !== 'iifl') {
            return res.status(400).json({ error: 'Invalid user type. Only IIFL is supported.' });
        }
        const user = await prisma.iIFLUser.findUnique({ where: { id: parseInt(id, 10) } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { token, totpSecret, ...safe } = user;
        res.json(safe);
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
        delete updateData.token;
        delete updateData.secretKey;
        delete updateData.totpSecret;

        if (type !== 'iifl') {
            return res.status(400).json({ error: 'Invalid user type. Only IIFL is supported.' });
        }
        const user = await prisma.iIFLUser.update({ where: { id: parseInt(id, 10) }, data: updateData });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const { token, totpSecret, ...safe } = user;
        res.json({ message: 'User updated successfully', user: safe });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        if (type !== 'iifl') {
            return res.status(400).json({ error: 'Invalid user type. Only IIFL is supported.' });
        }
        await prisma.iIFLUser.delete({ where: { id: parseInt(id, 10) } });
        const user = true;
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

        if (type !== 'iifl') {
            return res.status(400).json({ error: 'Invalid user type. Only IIFL is supported.' });
        }
        const user = await prisma.iIFLUser.update({
            where: { id: parseInt(id, 10) },
            data: { state: active ? 'active' : 'inactive' }
        });
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
        const users = await prisma.iIFLUser.findMany();
        const iiflUsers = users.length;
        const activeIIFLUsers = users.filter(u => u.token && u.state !== 'inactive').length;
        const capitals = users.map(u => u.capital || 0);
        const totalCapital = capitals.reduce((s,v)=>s+v,0);
        const avgCapital = capitals.length ? totalCapital / capitals.length : 0;
        const maxCapital = capitals.length ? Math.max(...capitals) : 0;
        const minCapital = capitals.length ? Math.min(...capitals) : 0;

        const stats = {
            totalUsers: iiflUsers,
            iiflUsers,
            activeUsers: activeIIFLUsers,
            activeIIFLUsers,
            capitalStats: { iifl: { totalCapital, avgCapital, maxCapital, minCapital } }
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

        const recentIIFLUsers = await prisma.iIFLUser.findMany({
            select: { clientName: true, userID: true, createdAt: true, updatedAt: true, state: true },
            orderBy: { updatedAt: 'desc' },
            take: parseInt(limit)
        });

        const activities = recentIIFLUsers.map(user => ({
            ...user.toObject(),
            broker: 'IIFL',
            type: 'iifl'
        }));

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

        if (type !== 'iifl') {
            return res.status(400).json({ error: 'Invalid user type. Only IIFL is supported.' });
        }
        const ids = userIds.map(id => parseInt(id, 10));
        const result = await prisma.iIFLUser.updateMany({ where: { id: { in: ids } }, data: { state: 'active' } });
        res.json({ message: `${result.count} users activated successfully`, modifiedCount: result.count });
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

        if (type !== 'iifl') {
            return res.status(400).json({ error: 'Invalid user type. Only IIFL is supported.' });
        }
        const ids = userIds.map(id => parseInt(id, 10));
        const result = await prisma.iIFLUser.updateMany({ where: { id: { in: ids } }, data: { state: 'inactive' } });
        res.json({ message: `${result.count} users deactivated successfully`, modifiedCount: result.count });
    } catch (error) {
        console.error('Error bulk deactivating users:', error);
        res.status(500).json({ error: 'Failed to deactivate users' });
    }
});

module.exports = router;
