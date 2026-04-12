import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// POST /api/members/[id]/set-leader
// Toggles leader status: if this member is already leader → unset; otherwise set this one and unset others in team
export async function POST(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    const member = await prisma.member.findUnique({ where: { id }, select: { id: true, teamId: true, isLeader: true } });
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (member.isLeader) {
        // Toggle off
        const updated = await prisma.member.update({ where: { id }, data: { isLeader: false } });
        return NextResponse.json(updated);
    }

    // Set this member as leader, unset others in the same team
    const [updated] = await prisma.$transaction([
        prisma.member.update({ where: { id }, data: { isLeader: true } }),
        prisma.member.updateMany({ where: { teamId: member.teamId, id: { not: id } }, data: { isLeader: false } }),
    ]);
    return NextResponse.json(updated);
}
