const express = require('express');
const router = express.Router();
const OrderResponse = require('../models/OrderResponse');
const OrderModel = require('../models/orderModel');

// Get dashboard data
router.get('/data', async (req, res) => {
    try {
        // Get today's date start and end
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const recentOrders = await OrderResponse.find({
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ timestamp: -1 }).limit(50);

        // Get order statistics for today
        const totalOrders = await OrderResponse.countDocuments({
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        });
        const successfulOrders = await OrderResponse.countDocuments({
            status: 'SUCCESS',
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        });
        const failedOrders = await OrderResponse.countDocuments({
            status: 'FAILED',
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        });

        // Get broker-wise statistics for today
        const angelOrders = await OrderResponse.countDocuments({
            broker: 'ANGEL',
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        });
        const motilalOrders = await OrderResponse.countDocuments({
            broker: 'MOTILAL',
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        });

        // Get recent telegram messages
        const recentMessages = await OrderModel.find({})
            .sort({ createdAt: -1 })
            .limit(50);

        // Get total messages count
        const totalMessages = await OrderModel.countDocuments({});

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
        const orders = await OrderResponse.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await OrderResponse.countDocuments(query);

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

        const messages = await OrderModel.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await OrderModel.countDocuments({});

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
