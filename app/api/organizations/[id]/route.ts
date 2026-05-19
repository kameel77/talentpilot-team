import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET /api/organizations/[id]
export async function GET(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    const org = await prisma.organization.findUnique({
        where: { id },
        include: {
            teams: {
                include: {
                    members: { include: { results: true } },
                    _count: { select: { members: true } },
                },
            },
        },
    });

    if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(org);
}

// PUT /api/organizations/[id]
export async function PUT(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    const body = await req.json();
    let { name, address, nip, email } = body;

    nip = nip?.trim() || null;
    address = address?.trim() || null;
    email = email?.trim() || null;

    try {
        const org = await prisma.organization.update({
            where: { id },
            data: { name, address, nip, email },
        });

        return NextResponse.json(org);
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

// DELETE /api/organizations/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    await prisma.organization.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
