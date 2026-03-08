import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET /api/teams/[id]
export async function GET(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    const team = await prisma.team.findUnique({
        where: { id },
        include: {
            organization: true,
            members: { include: { results: true }, orderBy: { name: 'asc' } },
        },
    });

    if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(team);
}

// PUT /api/teams/[id]
export async function PUT(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    const body = await req.json();
    const team = await prisma.team.update({ where: { id }, data: body });
    return NextResponse.json(team);
}

// DELETE /api/teams/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    await prisma.team.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
