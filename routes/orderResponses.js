const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');

// Get all order responses with pagination
router.get('/', async (req, res) => {
    try {
        // Build date filter
        let dateFilter = {};
        if (req.query.startDate && req.query.endDate) {
            const start = new Date(req.query.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(req.query.endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = {
                $gte: start,
                $lte: end
            };
        }

        // Build query filters for OrderResponse
        const orderQuery = {};
        if (req.query.broker) {
            orderQuery.broker = req.query.broker.toUpperCase();
        }
        if (req.query.status) {
            orderQuery.status = req.query.status.toUpperCase();
        }
        if (req.query.clientName) {
            orderQuery.clientName = new RegExp(req.query.clientName, 'i');
        }
        if (req.query.symbol) {
            orderQuery.symbol = new RegExp(req.query.symbol, 'i');
        }
        if (Object.keys(dateFilter).length > 0) {
            orderQuery.timestamp = dateFilter;
        }

        const where = {};
        if (orderQuery.broker) where.broker = orderQuery.broker;
        if (orderQuery.status) where.status = orderQuery.status;
        if (orderQuery.clientName) where.clientName = { contains: req.query.clientName, mode: 'insensitive' };
        if (orderQuery.symbol) where.symbol = { contains: req.query.symbol, mode: 'insensitive' };
        if (orderQuery.timestamp) where.timestamp = { gte: orderQuery.timestamp.$gte, lte: orderQuery.timestamp.$lte };

        const orderResponses = await prisma.orderResponse.findMany({
            where,
            orderBy: { timestamp: 'desc' }
        });

        res.json({
            success: true,
            orders: orderResponses,
            data: orderResponses, // For backward compatibility
            total: orderResponses.length
        });
    } catch (error) {
        console.error('Error fetching order responses:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order responses'
        });
    }
});

// Get order response by ID
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const orderResponse = await prisma.orderResponse.findUnique({ where: { id } });
        
        if (!orderResponse) {
            return res.status(404).json({
                success: false,
                error: 'Order response not found'
            });
        }

        res.json({
            success: true,
            data: orderResponse
        });
    } catch (error) {
        console.error('Error fetching order response:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order response'
        });
    }
});

// Get order statistics
router.get('/stats/summary', async (req, res) => {
    try {
        const all = await prisma.orderResponse.findMany();
        const overall = {
            totalOrders: all.length,
            successfulOrders: all.filter(o => o.status === 'SUCCESS').length,
            failedOrders: all.filter(o => o.status === 'FAILED').length,
            totalVolume: all.reduce((sum, o) => sum + (o.quantity || 0), 0),
            totalValue: all.reduce((sum, o) => sum + (o.price || 0) * (o.quantity || 0), 0)
        };
        const brokerStatsMap = new Map();
        for (const o of all) {
            const b = o.broker || 'UNKNOWN';
            const curr = brokerStatsMap.get(b) || { _id: b, count: 0, successCount: 0 };
            curr.count += 1;
            if (o.status === 'SUCCESS') curr.successCount += 1;
            brokerStatsMap.set(b, curr);
        }
        const brokerStats = Array.from(brokerStatsMap.values());

        res.json({
            success: true,
            data: {
                overall: stats[0] || {
                    totalOrders: 0,
                    successfulOrders: 0,
                    failedOrders: 0,
                    totalVolume: 0,
                    totalValue: 0
                },
                brokers: brokerStats
            }
        });
    } catch (error) {
        console.error('Error fetching order statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order statistics'
        });
    }
});

// Delete order response
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const orderResponse = await prisma.orderResponse.delete({ where: { id } });
        
        if (!orderResponse) {
            return res.status(404).json({
                success: false,
                error: 'Order response not found'
            });
        }

        res.json({
            success: true,
            message: 'Order response deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting order response:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete order response'
        });
    }
});

module.exports = router;
