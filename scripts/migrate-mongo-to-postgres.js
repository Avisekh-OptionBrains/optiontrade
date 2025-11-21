const { MongoClient } = require('mongodb')
const prisma = require('../prismaClient')
require('dotenv').config()

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.TESTLIST || process.env.MONGODB_URI
  if (!mongoUri) {
    console.error('Missing Mongo connection string. Set MONGO_URI (or TESTLIST/MONGODB_URI).')
    process.exit(1)
  }
  const client = new MongoClient(mongoUri)
  await client.connect()
  console.log('Connected to Mongo')

  await prisma.$connect()
  console.log('Connected to Postgres via Prisma')

  const dbNames = await client.db().admin().listDatabases()
  console.log('Mongo databases:', dbNames.databases.map(d => d.name).join(', '))

  const db = client.db() // default from URI

  async function copyCollection(mongoColl, rows, insertFn) {
    console.log(`Copying ${mongoColl} → ${rows.length} rows`)
    for (const row of rows) {
      try {
        await insertFn(row)
      } catch (e) {
        console.error(`Failed to insert into ${mongoColl}:`, e.message)
      }
    }
    console.log(`Done ${mongoColl}`)
  }

  // AdminUser
  const adminUsers = await db.collection('adminusers').find({}).toArray()
  await copyCollection('adminusers', adminUsers, r => prisma.adminUser.upsert({
    where: { email: r.email },
    create: {
      email: r.email,
      isAuthorized: !!r.isAuthorized,
      lastLogin: r.lastLogin || null,
      loginAttempts: r.loginAttempts || 0,
      lastLoginAttempt: r.lastLoginAttempt || null,
    },
    update: {
      isAuthorized: !!r.isAuthorized,
      lastLogin: r.lastLogin || null,
      loginAttempts: r.loginAttempts || 0,
      lastLoginAttempt: r.lastLoginAttempt || null,
    }
  }))

  // OTP
  const otps = await db.collection('otps').find({}).toArray()
  await copyCollection('otps', otps, r => prisma.oTP.create({
    data: {
      email: r.email,
      otp: r.otp,
      expiresAt: r.expiresAt,
      verified: !!r.verified,
      attempts: r.attempts || 0,
    }
  }))

  // AuthToken
  const tokens = await db.collection('authtokens').find({}).toArray()
  await copyCollection('authtokens', tokens, r => prisma.authToken.upsert({
    where: { token: r.token },
    create: {
      email: r.email,
      token: r.token,
      expiresAt: r.expiresAt,
      isActive: !!r.isActive,
      lastUsed: r.lastUsed || new Date(),
    },
    update: {
      email: r.email,
      expiresAt: r.expiresAt,
      isActive: !!r.isActive,
      lastUsed: r.lastUsed || new Date(),
    }
  }))

  // IIFLUser
  const iiflUsers = await db.collection('iiflusers').find({}).toArray()
  await copyCollection('iiflusers', iiflUsers, r => prisma.iIFLUser.upsert({
    where: { userID: r.userID },
    create: {
      email: r.email,
      phoneNumber: r.phoneNumber,
      clientName: r.clientName,
      userID: r.userID,
      password: r.password,
      appKey: r.appKey,
      appSecret: r.appSecret,
      totpSecret: r.totpSecret,
      token: r.token || null,
      capital: r.capital ?? null,
      state: r.state || 'live',
      tokenValidity: r.tokenValidity || null,
      lastLoginTime: r.lastLoginTime || null,
      tradingStatus: r.tradingStatus || 'active',
      loginStatus: r.loginStatus || 'pending',
      isInvestorClient: r.isInvestorClient ?? null,
      clientType: r.clientType ?? null,
      exchangeList: r.exchangeList ?? null,
    },
    update: {
      email: r.email,
      phoneNumber: r.phoneNumber,
      clientName: r.clientName,
      password: r.password,
      appKey: r.appKey,
      appSecret: r.appSecret,
      totpSecret: r.totpSecret,
      token: r.token || null,
      capital: r.capital ?? null,
      state: r.state || 'live',
      tokenValidity: r.tokenValidity || null,
      lastLoginTime: r.lastLoginTime || null,
      tradingStatus: r.tradingStatus || 'active',
      loginStatus: r.loginStatus || 'pending',
      isInvestorClient: r.isInvestorClient ?? null,
      clientType: r.clientType ?? null,
      exchangeList: r.exchangeList ?? null,
    }
  }))

  // OrderResponse
  const orderResponses = await db.collection('orderresponses').find({}).toArray()
  await copyCollection('orderresponses', orderResponses, r => prisma.orderResponse.create({
    data: {
      clientName: r.clientName,
      broker: r.broker,
      symbol: r.symbol,
      transactionType: r.transactionType,
      orderType: r.orderType,
      price: r.price,
      quantity: r.quantity,
      status: r.status,
      orderId: r.orderId || null,
      uniqueOrderId: r.uniqueOrderId || null,
      message: r.message || null,
      timestamp: r.timestamp || new Date(),
      response: r.response ?? null,
      apiKey: r.apiKey || null,
    }
  }))

  // WebhookOrder (orderModel)
  const webhookOrders = await db.collection('orders').find({}).toArray()
  await copyCollection('orders', webhookOrders, r => prisma.webhookOrder.create({
    data: {
      token: r.token,
      symbol: r.symbol,
      transactionType: r.transactionType,
      message: r.message,
      price: r.price,
      createdAt: r.createdAt || new Date(),
    }
  }))

  // LegacyOrder (order.js)
  const legacyOrders = await db.collection('orders').find({}).toArray()
  await copyCollection('orders(legacy)', legacyOrders, r => prisma.legacyOrder.create({
    data: {
      clientId: r.clientId,
      orderType: r.orderType,
      routeName: r.routeName || null,
      details: r.details ?? null,
      createdAt: r.createdAt || new Date(),
    }
  }))

  // OrderMessage (neworder.js)
  const orderMessages = await db.collection('ordermessages').find({}).toArray()
  await copyCollection('ordermessages', orderMessages, r => prisma.orderMessage.create({
    data: {
      clientId: r.clientId,
      orderType: r.orderType,
      strategyName: r.strategyName,
      details: r.details,
      broker: r.broker,
      symboltoken: r.symboltoken,
      createdAt: r.createdAt || new Date(),
    }
  }))

  // Client
  const clients = await db.collection('clients').find({}).toArray()
  await copyCollection('clients', clients, r => prisma.client.create({
    data: {
      clientId: r.clientId,
      jwtToken: r.jwtToken,
      apiKey: r.apiKey,
      capital: r.capital,
    }
  }))

  // Trade
  const trades = await db.collection('trades').find({}).toArray()
  await copyCollection('trades', trades, r => prisma.trade.create({
    data: {
      strategy: r.strategy,
      signal: r.signal,
      orders: r.orders,
      results: r.results,
      status: r.status || 'PENDING',
      createdAt: r.createdAt || new Date(),
    }
  }))

  // Subscriptions
  const optSubs = await db.collection('optiontradesubscriptions').find({}).toArray()
  await copyCollection('optiontradesubscriptions', optSubs, r => prisma.optionTradeSubscription.create({
    data: {
      userID: r.userID,
      enabled: !!r.enabled,
      lotSize: r.lotSize || 1,
      allowedSymbols: r.allowedSymbols ?? null,
      customSettings: r.customSettings ?? null,
      totalTrades: r.totalTrades || 0,
      lastTradeDate: r.lastTradeDate || null,
    }
  }))

  const bnSubs = await db.collection('bankniftysubscriptions').find({}).toArray()
  await copyCollection('bankniftysubscriptions', bnSubs, r => prisma.bankNiftySubscription.create({
    data: {
      userID: r.userID,
      enabled: !!r.enabled,
      lotSize: r.lotSize || 1,
      allowedSymbols: r.allowedSymbols ?? null,
      customSettings: r.customSettings ?? null,
      totalTrades: r.totalTrades || 0,
      lastTradeDate: r.lastTradeDate || null,
    }
  }))

  const epiSubs = await db.collection('epicrisesubscriptions').find({}).toArray()
  await copyCollection('epicrisesubscriptions', epiSubs, r => prisma.epicriseSubscription.create({
    data: {
      userID: r.userID,
      enabled: !!r.enabled,
      capital: r.capital,
      maxPositions: r.maxPositions || 1,
      riskPerTrade: r.riskPerTrade || 2,
      allowedSymbols: r.allowedSymbols ?? null,
      customSettings: r.customSettings ?? null,
      totalTrades: r.totalTrades || 0,
      lastTradeDate: r.lastTradeDate || null,
    }
  }))

  await client.close()
  await prisma.$disconnect()
  console.log('Migration complete')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})