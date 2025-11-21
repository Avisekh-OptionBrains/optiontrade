const prisma = require('../prismaClient')

class OTP {
  constructor(data) {
    Object.assign(this, data)
  }

  isExpired() {
    return Date.now() > new Date(this.expiresAt).getTime()
  }

  verify(inputOtp) {
    if (this.isExpired()) {
      return { success: false, error: 'OTP has expired' }
    }
    if ((this.attempts ?? 0) >= 3) {
      return { success: false, error: 'Maximum verification attempts exceeded' }
    }
    this.attempts = (this.attempts ?? 0) + 1
    if (this.otp === inputOtp) {
      this.verified = true
      return { success: true }
    }
    return { success: false, error: 'Invalid OTP' }
  }

  async save() {
    if (this.id) {
      const updated = await prisma.oTP.update({
        where: { id: this.id },
        data: {
          email: this.email,
          otp: this.otp,
          expiresAt: this.expiresAt,
          verified: this.verified ?? false,
          attempts: this.attempts ?? 0,
        },
      })
      Object.assign(this, updated)
      return this
    } else {
      const created = await prisma.oTP.create({
        data: {
          email: this.email,
          otp: this.otp,
          expiresAt: this.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
          verified: this.verified ?? false,
          attempts: this.attempts ?? 0,
        },
      })
      Object.assign(this, created)
      return this
    }
  }

  static async deleteMany(where) {
    await prisma.oTP.deleteMany({ where })
  }

  static async findOne(where) {
    const record = await prisma.oTP.findFirst({ where, orderBy: { createdAt: 'desc' } })
    return record ? new OTP(record) : null
  }
}

module.exports = OTP

