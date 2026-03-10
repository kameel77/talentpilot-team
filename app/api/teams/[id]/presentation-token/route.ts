import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth, unauthorized } from '@/lib/auth';
import { randomUUID } from 'crypto';

type Params = { params: Promise<{ id: string }> };

// POST /api/teams/[id]/presentation-token — generate or return existing token
export async function POST(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    // Check if team already has a token
    const existing = await prisma.team.findUnique({
        where: { id },
        select: { presentationToken: true },
    });

    if (!existing) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (existing.presentationToken) {
        return NextResponse.json({ token: existing.presentationToken });
    }

    // Generate a new token
    const token = randomUUID();
    await prisma.team.update({
        where: { id },
        data: { presentationToken: token },
    });

    return NextResponse.json({ token });
}
