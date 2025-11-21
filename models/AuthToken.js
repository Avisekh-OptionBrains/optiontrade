const prisma = require('../prismaClient')

class AuthToken {
  constructor(data) {
    Object.assign(this, data)
  }

  isExpired() {
    return Date.now() > new Date(this.expiresAt).getTime()
  }

  isValid() {
    return (this.isActive ?? true) && !this.isExpired()
  }

  async refreshUsage() {
    this.lastUsed = new Date()
    const updated = await prisma.authToken.update({
      where: { id: this.id },
      data: { lastUsed: this.lastUsed },
    })
    Object.assign(this, updated)
    return this
  }

  async save() {
    if (this.id) {
      const updated = await prisma.authToken.update({
        where: { id: this.id },
        data: {
          email: this.email,
          token: this.token,
          expiresAt: this.expiresAt,
          isActive: this.isActive ?? true,
          lastUsed: this.lastUsed ?? new Date(),
        },
      })
      Object.assign(this, updated)
      return this
    } else {
      const created = await prisma.authToken.create({
        data: {
          email: this.email,
          token: this.token,
          expiresAt: this.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
          isActive: this.isActive ?? true,
          lastUsed: this.lastUsed ?? new Date(),
        },
      })
      Object.assign(this, created)
      return this
    }
  }

  static async updateMany(where, data) {
    await prisma.authToken.updateMany({ where, data })
  }

  static async findOne(where) {
    const record = await prisma.authToken.findFirst({ where })
    return record ? new AuthToken(record) : null
  }
}

module.exports = AuthToken

