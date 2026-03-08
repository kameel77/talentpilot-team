import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth, unauthorized } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/members/[id]/upload-gallup
 *
 * Upload a Gallup PDF for a member. The PDF is relayed to the TalentPilot API
 * which parses it and returns structured talent data. The results are then stored.
 */
export async function POST(req: NextRequest, { params }: Params) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();
    const { id } = await params;

    const TALENTPILOT_API_URL = process.env.TALENTPILOT_API_URL;
    const TALENTPILOT_API_KEY = process.env.TALENTPILOT_API_KEY;

    if (!TALENTPILOT_API_URL || !TALENTPILOT_API_KEY) {
        return NextResponse.json(
            { error: 'TalentPilot API not configured' },
            { status: 500 }
        );
    }

    // Check member exists
    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) {
        return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Get the uploaded file from form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    try {
        // Relay PDF to TalentPilot API
        const apiFormData = new FormData();
        apiFormData.append('file', file);

        const apiUrl = `${TALENTPILOT_API_URL.replace(/\/$/, '')}/api/external/v1/gallup/parse?language=pl%2Ben`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'X-API-Key': TALENTPILOT_API_KEY },
            body: apiFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `TalentPilot API error: ${response.status}`, detail: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        const talents = data.talents || [];

        if (talents.length === 0) {
            return NextResponse.json(
                { error: 'No talents found in the PDF' },
                { status: 422 }
            );
        }

        // Clear existing results for this member
        await prisma.talentResult.deleteMany({ where: { memberId: id } });

        // Store new results
        const results = talents.map((t: { rank: number; talent: string; domain: { number: number } }) => {
            const domainMap: Record<number, string> = {
                1: 'executing',
                2: 'influencing',
                3: 'relationship_building',
                4: 'strategic_thinking',
            };

            return {
                memberId: id,
                rank: t.rank,
                talent: t.talent,
                domain: domainMap[t.domain.number] || 'executing',
            };
        });

        await prisma.talentResult.createMany({ data: results });

        // Fetch and return the updated member with results
        const updatedMember = await prisma.member.findUnique({
            where: { id },
            include: { results: { orderBy: { rank: 'asc' } } },
        });

        return NextResponse.json({
            member: updatedMember,
            talentsCount: talents.length,
            message: 'Gallup report processed successfully',
        });
    } catch (error) {
        console.error('Gallup upload error:', error);
        return NextResponse.json(
            { error: 'Failed to process Gallup report' },
            { status: 500 }
        );
    }
}
