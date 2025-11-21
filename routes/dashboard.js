const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

// Get dashboard data
router.get('/data', async (req, res) => {
    try {
        // Get today's date start and end
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const recentOrders = await prisma.orderResponse.findMany({
            where: { timestamp: { gte: startOfDay, lte: endOfDay } },
            orderBy: { timestamp: 'desc' },
            take: 50
        });

        // Get order statistics for today
        const totalOrders = await prisma.orderResponse.count({ where: { timestamp: { gte: startOfDay, lte: endOfDay } } });
        const successfulOrders = await prisma.orderResponse.count({ where: { status: 'SUCCESS', timestamp: { gte: startOfDay, lte: endOfDay } } });
        const failedOrders = await prisma.orderResponse.count({ where: { status: 'FAILED', timestamp: { gte: startOfDay, lte: endOfDay } } });

        // Get broker-wise statistics for today
        const angelOrders = await prisma.orderResponse.count({ where: { broker: 'ANGEL', timestamp: { gte: startOfDay, lte: endOfDay } } });
        const motilalOrders = await prisma.orderResponse.count({ where: { broker: 'MOTILAL', timestamp: { gte: startOfDay, lte: endOfDay } } });

        // Get recent telegram messages
        const recentMessages = await prisma.webhookOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });

        // Get total messages count
        const totalMessages = await prisma.webhookOrder.count();

        res.json({
            recentOrders,
            statistics: {
                total: totalOrders,
                successful: successfulOrders,
                failed: failedOrders,
                angelBroker: angelOrders,
                motilalBroker: motilalOrders,
                totalMessages: totalMessages
            },
            recentMessages
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get filtered orders
router.get('/orders', async (req, res) => {
    try {
        const { broker, status, startDate, endDate, page = 1, limit = 50 } = req.query;
        const query = {};

        if (broker) query.broker = broker.toUpperCase();
        if (status) query.status = status.toUpperCase();
        
        // If no date filters provided, default to today's orders
        if (startDate && endDate) {
            query.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else {
            // Default to today's orders
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);
            
            query.timestamp = {
                $gte: startOfDay,
                $lte: endOfDay
            };
        }

        const skip = (page - 1) * limit;
        const where = {};
        if (broker) where.broker = broker.toUpperCase();
        if (status) where.status = status.toUpperCase();
        const dateRange = {};
        if (startDate && endDate) {
            dateRange.gte = new Date(startDate);
            dateRange.lte = new Date(endDate);
        } else {
            dateRange.gte = startOfDay;
            dateRange.lte = endOfDay;
        }
        where.timestamp = dateRange;

        const orders = await prisma.orderResponse.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            skip,
            take: parseInt(limit)
        });

        const total = await prisma.orderResponse.count({ where });

        res.json({
            orders,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching filtered orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Get telegram messages
router.get('/messages', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (page - 1) * limit;

        const messages = await prisma.webhookOrder.findMany({
            orderBy: { createdAt: 'desc' },
            skip,
            take: parseInt(limit)
        });

        const total = await prisma.webhookOrder.count();

        res.json({
            messages,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching telegram messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

module.exports = router;
