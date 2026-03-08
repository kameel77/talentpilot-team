import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Użycie: npx tsx scripts/add-admin.ts <email> <hasło>');
        process.exit(1);
    }

    const email = args[0];
    const password = args[1];

    try {
        const hashedPassword = await bcrypt.hash(password, 12);

        const admin = await prisma.admin.upsert({
            where: { email },
            update: { password: hashedPassword },
            create: { email, password: hashedPassword },
        });

        console.log(`✅ Użytkownik pomyślnie dodany/zaktualizowany: ${admin.email}`);
    } catch (error) {
        console.error('Błąd podczas dodawania użytkownika:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
