import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth, unauthorized } from '@/lib/auth';

// GET /api/members?teamId=xxx
export async function GET(req: NextRequest) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();

    const teamId = req.nextUrl.searchParams.get('teamId');

    const members = await prisma.member.findMany({
        where: teamId ? { teamId } : undefined,
        include: { results: { orderBy: { rank: 'asc' } }, team: { select: { name: true } } },
        orderBy: { name: 'asc' },
    });

    return NextResponse.json(members);
}

// POST /api/members
export async function POST(req: NextRequest) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();

    const body = await req.json();

    if (Array.isArray(body)) {
        // Bulk insert
        const validMembers = body.filter(m => m.name && m.teamId);
        if (validMembers.length === 0) {
            return NextResponse.json({ error: 'No valid members provided' }, { status: 400 });
        }
        await prisma.member.createMany({
            data: validMembers.map(m => ({
                name: m.name,
                email: m.email || null,
                role: m.role || null,
                teamId: m.teamId
            }))
        });
        return NextResponse.json({ message: 'Members created', count: validMembers.length }, { status: 201 });
    }

    const { name, email, role, teamId, talents } = body;

    if (!name || !teamId) {
        return NextResponse.json({ error: 'Name and teamId are required' }, { status: 400 });
    }

    let resultsData = undefined;
    if (talents && Array.isArray(talents) && talents.length > 0) {
        resultsData = {
            create: talents.map((t: any) => {
                const domainMap: Record<number, string> = {
                    1: 'executing',
                    2: 'influencing',
                    3: 'relationship_building',
                    4: 'strategic_thinking',
                };
                return {
                    rank: t.rank,
                    talent: t.talent,
                    // If talent comes from external API it has domain.number, if it comes ready mapped or differently we fallback
                    domain: (t.domain && t.domain.number) ? (domainMap[t.domain.number] || 'executing') : (t.domain || 'executing'),
                };
            })
        };
    }

    const member = await prisma.member.create({
        data: { 
            name, 
            email, 
            role, 
            teamId,
            results: resultsData 
        },
        include: { results: true },
    });

    return NextResponse.json(member, { status: 201 });
}
