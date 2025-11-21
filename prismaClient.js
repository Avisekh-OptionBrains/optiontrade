const { PrismaClient } = require('@prisma/client')

const globalForPrisma = global

// Create Prisma client with singleton pattern to avoid multiple instances
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error', 'warn'],
})

if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

module.exports = prisma