const express = require('express');
const router = express.Router();
const OrderResponse = require('../models/OrderResponse');

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

        // Fetch from OrderResponse collection only
        const orderResponses = await OrderResponse.find(orderQuery)
            .sort({ timestamp: -1 })
            .lean();

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
        const orderResponse = await OrderResponse.findById(req.params.id);
        
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
        const stats = await OrderResponse.aggregate([
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    successfulOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] }
                    },
                    failedOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] }
                    },
                    totalVolume: { $sum: '$quantity' },
                    totalValue: { $sum: { $multiply: ['$price', '$quantity'] } }
                }
            }
        ]);

        const brokerStats = await OrderResponse.aggregate([
            {
                $group: {
                    _id: '$broker',
                    count: { $sum: 1 },
                    successCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] }
                    }
                }
            }
        ]);

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
        const orderResponse = await OrderResponse.findByIdAndDelete(req.params.id);
        
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
