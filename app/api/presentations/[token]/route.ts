import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ token: string }> };

// GET /api/presentations/[token] — PUBLIC, no auth required
export async function GET(_req: NextRequest, { params }: Params) {
    const { token } = await params;

    const team = await prisma.team.findUnique({
        where: { presentationToken: token },
        include: {
            organization: true,
            members: {
                include: { results: true },
                orderBy: { name: 'asc' },
            },
        },
    });

    if (!team) {
        return NextResponse.json({ error: 'Presentation not found' }, { status: 404 });
    }

    return NextResponse.json(team);
}
