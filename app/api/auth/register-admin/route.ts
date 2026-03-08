import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// POST /api/auth/register-admin
export async function POST(req: NextRequest) {
    // Odczytaj sekret i sprawdz, by zablokować przed publicznym dostepem
    const masterKey = req.headers.get('x-master-key');
    const envMasterKey = process.env.ADMIN_CREATION_MASTER_KEY;

    if (!envMasterKey || masterKey !== envMasterKey) {
        return NextResponse.json({ error: 'Unauthorized. Invalid MASTER KEY.' }, { status: 401 });
    }

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
        return NextResponse.json({ error: 'Brakujące parametry: email i password' }, { status: 400 });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 12);

        const admin = await prisma.admin.upsert({
            where: { email },
            update: { password: hashedPassword },
            create: { email, password: hashedPassword },
        });

        return NextResponse.json({
            message: `Administrator: ${admin.email} (utworzono lub zresetowano hasło)`,
            success: true
        });

    } catch (error) {
        return NextResponse.json({ error: 'Błąd bazy danych' }, { status: 500 });
    }
}
