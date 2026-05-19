import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth, unauthorized } from '@/lib/auth';

// GET /api/organizations — list all
export async function GET(req: NextRequest) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();

    const orgs = await prisma.organization.findMany({
        include: { teams: { include: { _count: { select: { members: true } } } } },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(orgs);
}

// POST /api/organizations — create
export async function POST(req: NextRequest) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();

    const body = await req.json();
    let { name, address, nip, email } = body;

    if (!name) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    nip = nip?.trim() || null;
    address = address?.trim() || null;
    email = email?.trim() || null;

    try {
        const org = await prisma.organization.create({
            data: { name, address, nip, email },
        });

        return NextResponse.json(org, { status: 201 });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json(
                { error: 'Organization with this NIP already exists.' }, 
                { status: 409 }
            );
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
