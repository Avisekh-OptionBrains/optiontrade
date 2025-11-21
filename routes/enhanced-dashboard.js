const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const IIFLUser = require('../models/IIFLUser');

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
        const recentOrders = await prisma.orderResponse.findMany({
            where: { timestamp: { gte: startOfDay, lte: endOfDay } },
            orderBy: { timestamp: 'desc' },
            take: 50
        });

        console.log(`Found ${recentOrders.length} orders for today`);

        // Get comprehensive statistics
        const [
            totalOrders,
            successfulOrders,
            failedOrders,
            pendingOrders,
            iiflOrders,
            totalMessages,
            iiflClients
        ] = await Promise.all([
            prisma.orderResponse.count({ where: { timestamp: { gte: startOfDay, lte: endOfDay } } }),
            prisma.orderResponse.count({ where: { status: 'SUCCESS', timestamp: { gte: startOfDay, lte: endOfDay } } }),
            prisma.orderResponse.count({ where: { status: 'FAILED', timestamp: { gte: startOfDay, lte: endOfDay } } }),
            prisma.orderResponse.count({ where: { status: 'PENDING', timestamp: { gte: startOfDay, lte: endOfDay } } }),
            prisma.orderResponse.count({ where: { broker: 'IIFL', timestamp: { gte: startOfDay, lte: endOfDay } } }),
            prisma.webhookOrder.count(),
            (await IIFLUser.find()).length
        ]);

        // Get hourly order distribution for charts
        const dayOrders = await prisma.orderResponse.findMany({ where: { timestamp: { gte: startOfDay, lte: endOfDay } } });
        const hourlyMap = new Map();
        for (const o of dayOrders) {
            const hour = new Date(o.timestamp).getHours();
            const key = `${hour}-${o.status}`;
            hourlyMap.set(key, (hourlyMap.get(key) || 0) + 1);
        }
        const hourlyData = Array.from(hourlyMap.entries()).map(([key, count]) => {
            const [hour, status] = key.split('-');
            return { _id: { hour: Number(hour), status }, count };
        }).sort((a,b)=>a._id.hour-b._id.hour);

        // Get top performing symbols
        const succDay = dayOrders.filter(o => o.status === 'SUCCESS');
        const symMap = new Map();
        for (const o of succDay) {
            const curr = symMap.get(o.symbol) || { _id: o.symbol, count: 0, totalQuantity: 0, priceSum: 0 };
            curr.count += 1; curr.totalQuantity += (o.quantity || 0); curr.priceSum += (o.price || 0);
            symMap.set(o.symbol, curr);
        }
        const topSymbols = Array.from(symMap.values()).map(v => ({ _id: v._id, count: v.count, totalQuantity: v.totalQuantity, avgPrice: v.count? v.priceSum/v.count:0 }))
            .sort((a,b)=>b.count-a.count).slice(0,10);

        // Get broker performance
        const brokerPerformanceMap = new Map();
        for (const o of dayOrders) {
            const key = `${o.broker}-${o.status}`;
            brokerPerformanceMap.set(key, (brokerPerformanceMap.get(key) || 0) + 1);
        }
        const brokerPerformance = Array.from(brokerPerformanceMap.entries()).map(([key,count])=>{
            const [broker,status]=key.split('-');
            return { _id: { broker, status }, count };
        });

        // Calculate success rates
        const successRate = totalOrders > 0 ? ((successfulOrders / totalOrders) * 100).toFixed(2) : 0;
        const iiflSuccessCount = await prisma.orderResponse.count({
            where: {
                broker: 'IIFL',
                status: 'SUCCESS',
                timestamp: { gte: startOfDay, lte: endOfDay }
            }
        });
        const iiflSuccessRate = iiflOrders > 0 ? ((iiflSuccessCount / iiflOrders) * 100).toFixed(2) : 0;

        // Get recent messages
        const recentMessages = await prisma.webhookOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });

        // Calculate total trading volume
        const totalValue = succDay.reduce((sum, o) => sum + (o.price || 0)*(o.quantity || 0), 0);
        const totalQuantity = succDay.reduce((sum, o) => sum + (o.quantity || 0), 0);

        const response = {
            statistics: {
                total: totalOrders,
                successful: successfulOrders,
                failed: failedOrders,
                pending: pendingOrders,
                successRate: parseFloat(successRate),
                iiflBroker: iiflOrders,
                iiflSuccessRate: parseFloat(iiflSuccessRate),
                totalMessages: totalMessages,
                iiflClients: iiflClients,
                totalClients: iiflClients,
                totalVolume: totalValue,
                totalQuantity: totalQuantity
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

        const recentOrders = await prisma.orderResponse.findMany({ where: { timestamp: { gte: fiveMinutesAgo } } });
        const statMap = new Map();
        for (const o of recentOrders) { statMap.set(o.status, (statMap.get(o.status)||0)+1); }
        const realtimeStats = Array.from(statMap.entries()).map(([status,count])=>({ _id: status, count }));

        const recentMessages = await prisma.webhookOrder.count({ where: { createdAt: { gte: fiveMinutesAgo } } });

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

        const perfOrders = await prisma.orderResponse.findMany({ where: { timestamp: { gte: startTime } }, orderBy: { timestamp: 'asc' } });
        const bucket = new Map();
        for (const o of perfOrders) {
            const dt = new Date(o.timestamp);
            const key = `${dt.getFullYear()}-${dt.getMonth()+1}-${dt.getDate()} ${dt.getHours()}:00`;
            const curr = bucket.get(key) || { totalOrders: 0, successfulOrders: 0, failedOrders: 0 };
            curr.totalOrders += 1;
            if (o.status === 'SUCCESS') curr.successfulOrders += 1;
            if (o.status === 'FAILED') curr.failedOrders += 1;
            bucket.set(key, curr);
        }
        const performanceData = Array.from(bucket.entries()).map(([key, v]) => ({ _id: key, ...v }));

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

        const where = {};
        if (startDate && endDate) { where.timestamp = { gte: new Date(startDate), lte: new Date(endDate) } }
        if (broker) where.broker = broker.toUpperCase();
        if (status) where.status = status.toUpperCase();
        const orders = await prisma.orderResponse.findMany({ where, orderBy: { timestamp: 'desc' } });

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

        // Build Prisma where clause
        const where = {};
        if (broker) where.broker = broker.toUpperCase();
        if (status) where.status = status.toUpperCase();
        if (clientName) where.clientName = { contains: clientName, mode: 'insensitive' };
        if (symbol) where.symbol = { contains: symbol, mode: 'insensitive' };
        if (Object.keys(dateFilter).length > 0) where.timestamp = { gte: dateFilter.$gte, lte: dateFilter.$lte };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await prisma.orderResponse.count({ where });
        const orderResponses = await prisma.orderResponse.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            skip,
            take: parseInt(limit)
        });

        // Apply pagination
        res.json({
            orders: orderResponses,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
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

        const total = await prisma.webhookOrder.count();
        const processed = await prisma.orderResponse.count();
        const today = await prisma.webhookOrder.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } });

        res.json({ total, processed, today });
    } catch (error) {
        console.error('Error fetching message stats:', error);
        res.status(500).json({ error: 'Failed to fetch message stats' });
    }
});

// Recent messages endpoint
router.get('/messages/recent', async (req, res) => {
    try {
        const messages = await prisma.webhookOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });

        res.json(messages);
    } catch (error) {
        console.error('Error fetching recent messages:', error);
        res.status(500).json({ error: 'Failed to fetch recent messages' });
    }
});

// Client stats endpoint
router.get('/clients/stats', async (req, res) => {
    try {
        const iiflUsers = (await IIFLUser.find()).length;
        const total = iiflUsers;

        // Count active users (those with valid tokens)
        const activeIIFL = (await IIFLUser.find()).filter(u => u.token && u.token !== '').length;
        const active = activeIIFL;

        res.json({
            total,
            active,
            iifl: iiflUsers
        });
    } catch (error) {
        console.error('Error fetching client stats:', error);
        res.status(500).json({ error: 'Failed to fetch client stats' });
    }
});

// Recent clients endpoint
router.get('/clients/recent', async (req, res) => {
    try {
        const iiflUsers = await prisma.iIFLUser.findMany({ orderBy: { updatedAt: 'desc' }, take: 10 });

        // Format the data
        const clients = iiflUsers.map(user => ({
            name: user.clientName || user.userID || 'Unknown',
            broker: 'IIFL',
            capital: user.capital || 0,
            isActive: !!(user.token && user.token !== ''),
            lastActive: user.updatedAt || user.lastLoginTime
        }));

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

        const filterWhere = {};
        if (dateFilter.$gte) filterWhere.timestamp = { gte: dateFilter.$gte };
        const orders = await prisma.orderResponse.findMany({ where: filterWhere });
        const map = new Map();
        for (const o of orders) {
            if (!o.symbol) continue;
            const curr = map.get(o.symbol) || { totalOrders: 0, successfulOrders: 0, totalVolume: 0, priceSum: 0 };
            curr.totalOrders += 1;
            if (o.status === 'SUCCESS') curr.successfulOrders += 1;
            curr.totalVolume += (o.price || 0) * (o.quantity || 0);
            curr.priceSum += (o.price || 0);
            map.set(o.symbol, curr);
        }
        const symbolStats = Array.from(map.entries()).map(([symbol, v]) => ({
            symbol,
            totalOrders: v.totalOrders,
            successRate: v.totalOrders ? Math.round((v.successfulOrders / v.totalOrders) * 10000) / 100 : 0,
            avgPrice: v.totalOrders ? Math.round((v.priceSum / v.totalOrders) * 100) / 100 : 0,
            totalVolume: Math.round(v.totalVolume * 100) / 100
        })).sort((a,b)=>b.totalOrders-a.totalOrders).slice(0,10);

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
        const orders = await prisma.orderResponse.findMany({
            orderBy: { timestamp: 'desc' },
            take: 1000
        });

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
