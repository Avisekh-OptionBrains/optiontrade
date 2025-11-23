const WebSocket = require('ws');
const http = require('http');

class WebSocketManager {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Set();
        this.setupWebSocketServer();
    }

    setupWebSocketServer() {
        this.wss.on('connection', (ws, req) => {
            console.log('New WebSocket connection established');
            this.clients.add(ws);

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'connection',
                message: 'Connected to Epicrise Trading Platform',
                timestamp: new Date().toISOString()
            }));

            // Handle incoming messages
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleClientMessage(ws, data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });

            // Handle connection close
            ws.on('close', () => {
                console.log('WebSocket connection closed');
                this.clients.delete(ws);
            });

            // Handle errors
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });

            // Send periodic heartbeat
            const heartbeat = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping();
                } else {
                    clearInterval(heartbeat);
                }
            }, 30000);

            ws.on('pong', () => {
                // Client is alive
            });
        });

        console.log('WebSocket server initialized');
    }

    handleClientMessage(ws, data) {
        switch (data.type) {
            case 'subscribe':
                this.handleSubscription(ws, data);
                break;
            case 'unsubscribe':
                this.handleUnsubscription(ws, data);
                break;
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    handleSubscription(ws, data) {
        // Add subscription logic here
        ws.subscriptions = ws.subscriptions || new Set();
        ws.subscriptions.add(data.channel);
        
        ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            channel: data.channel,
            timestamp: new Date().toISOString()
        }));
    }

    handleUnsubscription(ws, data) {
        if (ws.subscriptions) {
            ws.subscriptions.delete(data.channel);
        }
        
        ws.send(JSON.stringify({
            type: 'unsubscription_confirmed',
            channel: data.channel,
            timestamp: new Date().toISOString()
        }));
    }

    // Broadcast methods
    broadcast(message) {
        const data = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    }

    broadcastToChannel(channel, message) {
        const data = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && 
                client.subscriptions && 
                client.subscriptions.has(channel)) {
                client.send(data);
            }
        });
    }

    // Trading-specific broadcast methods
    broadcastNewOrder(orderData) {
        this.broadcast({
            type: 'new_order',
            data: orderData,
            timestamp: new Date().toISOString()
        });
    }

    broadcastOrderUpdate(orderData) {
        this.broadcast({
            type: 'order_update',
            data: orderData,
            timestamp: new Date().toISOString()
        });
    }

    broadcastNewMessage(messageData) {
        this.broadcast({
            type: 'new_message',
            data: messageData,
            timestamp: new Date().toISOString()
        });
    }

    broadcastSystemAlert(alertData) {
        this.broadcast({
            type: 'system_alert',
            data: alertData,
            timestamp: new Date().toISOString()
        });
    }

    broadcastMarketData(marketData) {
        this.broadcastToChannel('market_data', {
            type: 'market_update',
            data: marketData,
            timestamp: new Date().toISOString()
        });
    }

    // Statistics and monitoring
    getConnectionStats() {
        return {
            totalConnections: this.clients.size,
            activeConnections: Array.from(this.clients).filter(
                client => client.readyState === WebSocket.OPEN
            ).length
        };
    }

    // Cleanup method
    close() {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.close();
            }
        });
        this.wss.close();
    }
}

module.exports = WebSocketManager;
