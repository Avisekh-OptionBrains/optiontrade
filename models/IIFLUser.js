const prisma = require('../prismaClient')

class IIFLUser {
  constructor(data) {
    Object.assign(this, data)
  }

  async save() {
    if (this.id) {
      const updated = await prisma.iIFLUser.update({
        where: { id: this.id },
        data: {
          email: this.email,
          phoneNumber: this.phoneNumber,
          clientName: this.clientName,
          userID: this.userID,
          password: this.password,
          appKey: this.appKey,
          appSecret: this.appSecret,
          totpSecret: this.totpSecret,
          token: this.token ?? null,
          capital: this.capital ?? null,
          state: this.state ?? 'live',
          tokenValidity: this.tokenValidity ?? null,
          lastLoginTime: this.lastLoginTime ?? null,
          tradingStatus: this.tradingStatus ?? 'active',
          loginStatus: this.loginStatus ?? 'pending',
          isInvestorClient: this.isInvestorClient ?? null,
          clientType: this.clientType ?? null,
          exchangeList: this.exchangeList ?? null,
        },
      })
      Object.assign(this, updated)
      return this
    } else {
      const created = await prisma.iIFLUser.create({
        data: {
          email: this.email,
          phoneNumber: this.phoneNumber,
          clientName: this.clientName,
          userID: this.userID,
          password: this.password,
          appKey: this.appKey,
          appSecret: this.appSecret,
          totpSecret: this.totpSecret,
          token: this.token ?? null,
          capital: this.capital ?? null,
          state: this.state ?? 'live',
          tokenValidity: this.tokenValidity ?? null,
          lastLoginTime: this.lastLoginTime ?? null,
          tradingStatus: this.tradingStatus ?? 'active',
          loginStatus: this.loginStatus ?? 'pending',
          isInvestorClient: this.isInvestorClient ?? null,
          clientType: this.clientType ?? null,
          exchangeList: this.exchangeList ?? null,
        },
      })
      Object.assign(this, created)
      return this
    }
  }

  static async find() {
    const rows = await prisma.iIFLUser.findMany()
    return rows.map(r => new IIFLUser(r))
  }
}

module.exports = IIFLUser
