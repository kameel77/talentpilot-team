import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// PUT /api/members/[id]/talents
// Upserts a talent result for a member.
// Body: { talentCode: string, rank: number, domain: string }
export async function PUT(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id: memberId } = await params;

    try {
        const body = await req.json();
        const { talentCode, rank, domain } = body;

        if (!talentCode || typeof rank !== 'number' || !domain) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if member exists
        const member = await prisma.member.findUnique({
            where: { id: memberId }
        });

        if (!member) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }

        // Check if talent already exists for this member
        const existingResult = await prisma.talentResult.findFirst({
            where: { memberId, talent: talentCode }
        });

        let result;
        if (existingResult) {
            // Update
            result = await prisma.talentResult.update({
                where: { id: existingResult.id },
                data: { rank, domain }
            });
        } else {
            // Create
            result = await prisma.talentResult.create({
                data: {
                    memberId,
                    talent: talentCode,
                    rank,
                    domain
                }
            });
        }

        return NextResponse.json({ success: true, result });
    } catch (error) {
        console.error('Failed to upsert talent:', error);
        return NextResponse.json({ error: 'Failed to update talent' }, { status: 500 });
    }
}
