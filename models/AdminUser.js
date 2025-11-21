const prisma = require('../prismaClient')

class AdminUser {
  constructor(data) {
    Object.assign(this, data)
  }

  isEmailAuthorized() {
    return this.email === 'techsupport@optionbrains.com'
  }

  async save() {
    if (this.id) {
      const updated = await prisma.adminUser.update({
        where: { id: this.id },
        data: {
          email: this.email,
          isAuthorized: this.isAuthorized ?? false,
          lastLogin: this.lastLogin ?? null,
          loginAttempts: this.loginAttempts ?? 0,
          lastLoginAttempt: this.lastLoginAttempt ?? null,
        },
      })
      Object.assign(this, updated)
      return this
    } else {
      const created = await prisma.adminUser.create({
        data: {
          email: this.email,
          isAuthorized: this.isAuthorized ?? false,
          lastLogin: this.lastLogin ?? null,
          loginAttempts: this.loginAttempts ?? 0,
          lastLoginAttempt: this.lastLoginAttempt ?? null,
        },
      })
      Object.assign(this, created)
      return this
    }
  }

  static async findOne(where) {
    const record = await prisma.adminUser.findFirst({ where })
    return record ? new AdminUser(record) : null
  }

  static async findOneAndUpdate(where, data) {
    let uniqueWhere = {}
    if (where.id) uniqueWhere.id = where.id
    if (where.email) uniqueWhere.email = where.email
    const updated = await prisma.adminUser.update({ where: uniqueWhere, data })
    return new AdminUser(updated)
  }
}

module.exports = AdminUser

