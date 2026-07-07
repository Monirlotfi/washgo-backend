const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  const phone = '+212612345678';

  // Use upsert to modify or create without breaking foreign key relations
  const user = await prisma.user.upsert({
    where: { phone: phone },
    update: {
      fullName: 'Admin',
      passwordHash: hash,
      role: 'ADMIN',
    },
    create: {
      fullName: 'Admin',
      phone: phone,
      passwordHash: hash,
      role: 'ADMIN',
    },
  });

  console.log('Admin processed successfully:', user.phone, `(Role: ${user.role})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
  });