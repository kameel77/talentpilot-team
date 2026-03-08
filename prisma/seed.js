const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = process.env.ADMIN_EMAIL || 'admin@talentpilot.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await prisma.admin.upsert({
        where: { email },
        update: { password: hashedPassword },
        create: { email, password: hashedPassword },
    });

    console.log(`✅ Admin seeded: ${admin.email}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
