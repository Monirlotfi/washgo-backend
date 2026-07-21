const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
prisma.user.findMany({ select: { id: true, phone: true, role: true, passwordHash: true, fullName: true } })
  .then(async (r) => {
    console.log(JSON.stringify(r, null, 2));
    for (const u of r) {
      const valid = await bcrypt.compare('admin123', u.passwordHash);
      console.log(`  ${u.phone} (${u.role}) password valid: ${valid}`);
    }
    return prisma.$disconnect();
  })
  .catch(e => { console.log(e.message); process.exit(1); });
