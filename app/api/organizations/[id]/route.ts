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
    const org = await prisma.organization.update({
        where: { id },
        data: body,
    });

    return NextResponse.json(org);
}

// DELETE /api/organizations/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    await prisma.organization.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
