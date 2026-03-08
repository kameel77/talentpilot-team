import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth, unauthorized } from '@/lib/auth';

// GET /api/teams?orgId=xxx — list teams for org
export async function GET(req: NextRequest) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();

    const orgId = req.nextUrl.searchParams.get('orgId');

    const teams = await prisma.team.findMany({
        where: orgId ? { organizationId: orgId } : undefined,
        include: {
            organization: { select: { name: true } },
            members: { include: { results: true } },
            _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(teams);
}

// POST /api/teams
export async function POST(req: NextRequest) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();

    const body = await req.json();
    const { name, organizationId } = body;

    if (!name || !organizationId) {
        return NextResponse.json({ error: 'Name and organizationId are required' }, { status: 400 });
    }

    const team = await prisma.team.create({
        data: { name, organizationId },
        include: { organization: { select: { name: true } } },
    });

    return NextResponse.json(team, { status: 201 });
}
