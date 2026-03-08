import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// GET /api/members/[id]
export async function GET(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    const member = await prisma.member.findUnique({
        where: { id },
        include: { results: { orderBy: { rank: 'asc' } }, team: { include: { organization: true } } },
    });

    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(member);
}

// PUT /api/members/[id]
export async function PUT(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    const body = await req.json();
    const member = await prisma.member.update({ where: { id }, data: body });
    return NextResponse.json(member);
}

// DELETE /api/members/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    await prisma.member.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
