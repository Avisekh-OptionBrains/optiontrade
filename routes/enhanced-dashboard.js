const express = require('express');
const router = express.Router();
const OrderResponse = require('../models/OrderResponse');
const OrderModel = require('../models/order');
const Angeluser = require('../models/Angeluser');
const MOUser = require('../models/MOUser');

// Enhanced dashboard data endpoint
router.get('/data', async (req, res) => {
    try {
        console.log('Enhanced dashboard data endpoint called');

        // Get today's date range
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Get recent orders with more details
        const recentOrders = await OrderResponse.find({
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

        console.log(`Found ${recentOrders.length} orders for today`);

        // Get comprehensive statistics
        const [
            totalOrders,
            successfulOrders,
            failedOrders,
            pendingOrders,
            angelOrders,
            motilalOrders,
            totalMessages,
            angelClients,
            motilalClients
        ] = await Promise.all([
            OrderResponse.countDocuments({ timestamp: { $gte: startOfDay, $lte: endOfDay } }),
            OrderResponse.countDocuments({ status: 'SUCCESS', timestamp: { $gte: startOfDay, $lte: endOfDay } }),
            OrderResponse.countDocuments({ status: 'FAILED', timestamp: { $gte: startOfDay, $lte: endOfDay } }),
            OrderResponse.countDocuments({ status: 'PENDING', timestamp: { $gte: startOfDay, $lte: endOfDay } }),
            OrderResponse.countDocuments({ broker: 'ANGEL', timestamp: { $gte: startOfDay, $lte: endOfDay } }),
            OrderResponse.countDocuments({ broker: 'MOTILAL', timestamp: { $gte: startOfDay, $lte: endOfDay } }),
            OrderModel.countDocuments({}),
            Angeluser.countDocuments({}),
            MOUser.countDocuments({})
        ]);

        // Get hourly order distribution for charts
        const hourlyData = await OrderResponse.aggregate([
            {
                $match: {
                    timestamp: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $group: {
                    _id: {
                        hour: { $hour: "$timestamp" },
                        status: "$status"
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.hour": 1 }
            }
        ]);

        // Get top performing symbols
        const topSymbols = await OrderResponse.aggregate([
            {
                $match: {
                    timestamp: { $gte: startOfDay, $lte: endOfDay },
                    status: 'SUCCESS'
                }
            },
            {
                $group: {
                    _id: "$symbol",
                    count: { $sum: 1 },
                    totalQuantity: { $sum: "$quantity" },
                    avgPrice: { $avg: "$price" }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 10
            }
        ]);

        // Get broker performance
        const brokerPerformance = await OrderResponse.aggregate([
            {
                $match: {
                    timestamp: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $group: {
                    _id: {
                        broker: "$broker",
                        status: "$status"
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Calculate success rates
        const successRate = totalOrders > 0 ? ((successfulOrders / totalOrders) * 100).toFixed(2) : 0;
        const angelSuccessRate = angelOrders > 0 ? 
            ((await OrderResponse.countDocuments({ 
                broker: 'ANGEL', 
                status: 'SUCCESS', 
                timestamp: { $gte: startOfDay, $lte: endOfDay } 
            }) / angelOrders) * 100).toFixed(2) : 0;
        const motilalSuccessRate = motilalOrders > 0 ? 
            ((await OrderResponse.countDocuments({ 
                broker: 'MOTILAL', 
                status: 'SUCCESS', 
                timestamp: { $gte: startOfDay, $lte: endOfDay } 
            }) / motilalOrders) * 100).toFixed(2) : 0;

        // Get recent messages
        const recentMessages = await OrderModel.find({})
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        // Calculate total trading volume
        const totalVolume = await OrderResponse.aggregate([
            {
                $match: {
                    timestamp: { $gte: startOfDay, $lte: endOfDay },
                    status: 'SUCCESS'
                }
            },
            {
                $group: {
                    _id: null,
                    totalValue: { $sum: { $multiply: ["$price", "$quantity"] } },
                    totalQuantity: { $sum: "$quantity" }
                }
            }
        ]);

        const response = {
            statistics: {
                total: totalOrders,
                successful: successfulOrders,
                failed: failedOrders,
                pending: pendingOrders,
                successRate: parseFloat(successRate),
                angelBroker: angelOrders,
                motilalBroker: motilalOrders,
                angelSuccessRate: parseFloat(angelSuccessRate),
                motilalSuccessRate: parseFloat(motilalSuccessRate),
                totalMessages: totalMessages,
                angelClients: angelClients,
                motilalClients: motilalClients,
                totalClients: angelClients + motilalClients,
                totalVolume: totalVolume.length > 0 ? totalVolume[0].totalValue : 0,
                totalQuantity: totalVolume.length > 0 ? totalVolume[0].totalQuantity : 0
            },
            recentOrders,
            recentMessages,
            hourlyData,
            topSymbols,
            brokerPerformance,
            systemInfo: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version,
                platform: process.platform
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching enhanced dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get real-time statistics
router.get('/stats/realtime', async (req, res) => {
    try {
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

        const realtimeStats = await OrderResponse.aggregate([
            {
                $match: {
                    timestamp: { $gte: fiveMinutesAgo }
                }
            },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        const recentMessages = await OrderModel.countDocuments({
            createdAt: { $gte: fiveMinutesAgo }
        });

        // WebSocket connection stats
        const wsStats = global.wsManager ? global.wsManager.getConnectionStats() : { totalConnections: 0, activeConnections: 0 };

        res.json({
            realtimeStats,
            recentMessages,
            websocketStats: wsStats,
            timestamp: now.toISOString()
        });
    } catch (error) {
        console.error('Error fetching realtime stats:', error);
        res.status(500).json({ error: 'Failed to fetch realtime stats' });
    }
});

// Get performance metrics
router.get('/performance', async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        
        let startTime;
        switch (timeframe) {
            case '1h':
                startTime = new Date(Date.now() - 60 * 60 * 1000);
                break;
            case '6h':
                startTime = new Date(Date.now() - 6 * 60 * 60 * 1000);
                break;
            case '24h':
                startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            default:
                startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        }

        const performanceData = await OrderResponse.aggregate([
            {
                $match: {
                    timestamp: { $gte: startTime }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: timeframe === '1h' ? "%Y-%m-%d %H:%M" : "%Y-%m-%d %H:00",
                            date: "$timestamp"
                        }
                    },
                    totalOrders: { $sum: 1 },
                    successfulOrders: {
                        $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] }
                    },
                    failedOrders: {
                        $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] }
                    },
                    avgResponseTime: { $avg: "$responseTime" }
                }
            },
            {
                $sort: { "_id": 1 }
            }
        ]);

        res.json({
            timeframe,
            data: performanceData
        });
    } catch (error) {
        console.error('Error fetching performance data:', error);
        res.status(500).json({ error: 'Failed to fetch performance data' });
    }
});

// Export data endpoint
router.get('/export/:format', async (req, res) => {
    try {
        const { format } = req.params;
        const { startDate, endDate, broker, status } = req.query;

        const query = {};
        if (startDate && endDate) {
            query.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        if (broker) query.broker = broker.toUpperCase();
        if (status) query.status = status.toUpperCase();

        const orders = await OrderResponse.find(query).sort({ timestamp: -1 });

        if (format === 'json') {
            res.json(orders);
        } else if (format === 'csv') {
            // Convert to CSV format
            const csv = convertToCSV(orders);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
            res.send(csv);
        } else {
            res.status(400).json({ error: 'Unsupported format. Use json or csv.' });
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Helper function to convert to CSV
function convertToCSV(data) {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
        return headers.map(header => {
            const value = row[header];
            return typeof value === 'string' ? `"${value}"` : value;
        }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
}

// Orders endpoint for orders management section
router.get('/orders', async (req, res) => {
    try {
        const { broker, status, startDate, endDate, page = 1, limit = 50, clientName, symbol } = req.query;

        // Build date filter
        let dateFilter = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter = {
                $gte: start,
                $lte: end
            };
        }

        // Query OrderResponse collection
        const orderResponseQuery = {};
        if (broker) orderResponseQuery.broker = broker.toUpperCase();
        if (status) orderResponseQuery.status = status.toUpperCase();
        if (clientName) orderResponseQuery.clientName = new RegExp(clientName, 'i');
        if (symbol) orderResponseQuery.symbol = new RegExp(symbol, 'i');
        if (Object.keys(dateFilter).length > 0) {
            orderResponseQuery.timestamp = dateFilter;
        }

        // Fetch from OrderResponse collection only
        const orderResponses = await OrderResponse.find(orderResponseQuery)
            .sort({ timestamp: -1 })
            .lean();

        // Transform OrderResponse records
        const allOrders = orderResponses.map(order => ({
            _id: order._id,
            timestamp: order.timestamp,
            clientName: order.clientName,
            broker: order.broker,
            symbol: order.symbol,
            transactionType: order.transactionType,
            orderType: order.orderType,
            quantity: order.quantity,
            price: order.price,
            status: order.status,
            orderId: order.orderId,
            message: order.message
        }));

        // Apply pagination
        const skip = (page - 1) * limit;
        const paginatedOrders = allOrders.slice(skip, skip + parseInt(limit));
        const total = allOrders.length;

        res.json({
            orders: paginatedOrders,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Messages stats endpoint
router.get('/messages/stats', async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const total = await OrderModel.countDocuments({});
        const processed = await OrderResponse.countDocuments({});
        const today = await OrderModel.countDocuments({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        res.json({ total, processed, today });
    } catch (error) {
        console.error('Error fetching message stats:', error);
        res.status(500).json({ error: 'Failed to fetch message stats' });
    }
});

// Recent messages endpoint
router.get('/messages/recent', async (req, res) => {
    try {
        const messages = await OrderModel.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        res.json(messages);
    } catch (error) {
        console.error('Error fetching recent messages:', error);
        res.status(500).json({ error: 'Failed to fetch recent messages' });
    }
});

// Client stats endpoint
router.get('/clients/stats', async (req, res) => {
    try {
        const angelUsers = await Angeluser.countDocuments({});
        const motilalUsers = await MOUser.countDocuments({});
        const total = angelUsers + motilalUsers;

        // Count active users (those with valid tokens)
        const activeAngel = await Angeluser.countDocuments({
            jwtToken: { $exists: true, $ne: null, $ne: '' }
        });
        const activeMotilal = await MOUser.countDocuments({
            jwtToken: { $exists: true, $ne: null, $ne: '' }
        });
        const active = activeAngel + activeMotilal;

        res.json({
            total,
            active,
            angel: angelUsers,
            motilal: motilalUsers
        });
    } catch (error) {
        console.error('Error fetching client stats:', error);
        res.status(500).json({ error: 'Failed to fetch client stats' });
    }
});

// Recent clients endpoint
router.get('/clients/recent', async (req, res) => {
    try {
        const angelUsers = await Angeluser.find({}, {
            password: 0,
            totpKey: 0
        }).sort({ updatedAt: -1 }).limit(5).lean();

        const motilalUsers = await MOUser.find({}, {
            password: 0,
            totpKey: 0
        }).sort({ updatedAt: -1 }).limit(5).lean();

        // Combine and format the data
        const clients = [
            ...angelUsers.map(user => ({
                name: user.clientName || user.username || 'Unknown',
                broker: 'ANGEL',
                capital: user.capital || 0,
                isActive: !!(user.jwtToken && user.jwtToken !== ''),
                lastActive: user.updatedAt
            })),
            ...motilalUsers.map(user => ({
                name: user.clientName || user.username || 'Unknown',
                broker: 'MOTILAL',
                capital: user.capital || 0,
                isActive: !!(user.jwtToken && user.jwtToken !== ''),
                lastActive: user.updatedAt
            }))
        ].sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive)).slice(0, 10);

        res.json(clients);
    } catch (error) {
        console.error('Error fetching recent clients:', error);
        res.status(500).json({ error: 'Failed to fetch recent clients' });
    }
});

// Analytics symbols endpoint
router.get('/analytics/symbols', async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;
        let dateFilter = {};

        // Calculate date range based on timeframe
        const now = new Date();
        switch (timeframe) {
            case '24h':
                dateFilter = { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
                break;
            case '7d':
                dateFilter = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
                break;
            case '30d':
                dateFilter = { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
                break;
        }

        const symbolStats = await OrderResponse.aggregate([
            {
                $match: {
                    timestamp: dateFilter,
                    symbol: { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$symbol',
                    totalOrders: { $sum: 1 },
                    successfulOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] }
                    },
                    totalVolume: { $sum: { $multiply: ['$price', '$quantity'] } },
                    avgPrice: { $avg: '$price' }
                }
            },
            {
                $project: {
                    symbol: '$_id',
                    totalOrders: 1,
                    successRate: {
                        $round: [
                            { $multiply: [{ $divide: ['$successfulOrders', '$totalOrders'] }, 100] },
                            2
                        ]
                    },
                    avgPrice: { $round: ['$avgPrice', 2] },
                    totalVolume: { $round: ['$totalVolume', 2] }
                }
            },
            { $sort: { totalOrders: -1 } },
            { $limit: 10 }
        ]);

        res.json(symbolStats);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// System status endpoint
router.get('/system/status', async (req, res) => {
    try {
        const uptime = process.uptime();
        const uptimeString = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

        res.json({
            uptime: uptimeString,
            status: 'operational',
            database: 'connected',
            websocket: 'active'
        });
    } catch (error) {
        console.error('Error fetching system status:', error);
        res.status(500).json({ error: 'Failed to fetch system status' });
    }
});

// Settings endpoint
router.post('/settings', async (req, res) => {
    try {
        // For now, just return success - in a real app you'd save to database
        console.log('Settings saved:', req.body);
        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Test message endpoint
router.post('/test-message', async (req, res) => {
    try {
        // Create a test message
        const testMessage = new OrderModel({
            symbol: 'TEST',
            action: 'BUY',
            price: 100,
            stopLoss: 95,
            status: 'PROCESSED',
            messageText: 'Test message from dashboard'
        });

        await testMessage.save();
        res.json({ success: true, message: 'Test message sent successfully' });
    } catch (error) {
        console.error('Error sending test message:', error);
        res.status(500).json({ error: 'Failed to send test message' });
    }
});

// Orders export endpoint
router.get('/orders/export', async (req, res) => {
    try {
        const orders = await OrderResponse.find({})
            .sort({ timestamp: -1 })
            .limit(1000)
            .lean();

        // Convert to CSV format
        const csvHeader = 'Order ID,Time,Client,Broker,Symbol,Action,Quantity,Price,Status\n';
        const csvData = orders.map(order =>
            `${order.orderId || 'N/A'},${order.timestamp},${order.clientName || 'N/A'},${order.broker},${order.symbol},${order.action},${order.quantity},${order.price},${order.status}`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
        res.send(csvHeader + csvData);
    } catch (error) {
        console.error('Error exporting orders:', error);
        res.status(500).json({ error: 'Failed to export orders' });
    }
});

// Simple test endpoint
router.get('/test', (req, res) => {
    console.log('Test endpoint called');
    res.json({ message: 'Enhanced dashboard API is working!', timestamp: new Date() });
});

module.exports = router;
