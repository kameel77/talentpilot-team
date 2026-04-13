import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth, unauthorized } from '@/lib/auth';

/**
 * POST /api/provision-users
 *
 * Bulk-provisions TalentPilot accounts for selected team members.
 *
 * Flow:
 * 1. Fetch team + organization (with talentpilotOrgId / talentpilotTeamId).
 * 2. If IDs missing → call external /provision/org-team to create org/team and save IDs.
 * 3. Call external /provision/users with member data + talents.
 * 4. Return per-user results.
 *
 * Body: { teamId: string, memberIds: string[] }
 */
export async function POST(req: NextRequest) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();

    const { teamId, memberIds } = await req.json() as { teamId: string; memberIds: string[] };

    if (!teamId || !Array.isArray(memberIds) || memberIds.length === 0) {
        return NextResponse.json({ error: 'teamId and memberIds are required' }, { status: 400 });
    }

    const TALENTPILOT_API_URL = (process.env.TALENTPILOT_API_URL || '').replace(/^["']|["']$/g, '').replace(/\/$/, '');
    const TALENTPILOT_API_KEY = (process.env.TALENTPILOT_API_KEY || '').replace(/^["']|["']$/g, '');

    if (!TALENTPILOT_API_URL || !TALENTPILOT_API_KEY) {
        return NextResponse.json({ error: 'TalentPilot API not configured' }, { status: 500 });
    }

    // 1. Fetch team with org and selected members + their talents
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
            organization: true,
            members: {
                where: { id: { in: memberIds } },
                include: { results: { orderBy: { rank: 'asc' } } },
            },
        },
    });

    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

    const membersWithEmail = team.members.filter(m => m.email && m.email.trim() !== '');
    const membersWithoutEmail = team.members.filter(m => !m.email || m.email.trim() === '');

    let { talentpilotOrgId, talentpilotTeamId } = team as typeof team & {
        talentpilotOrgId: number | null;
        talentpilotTeamId: number | null;
    };
    const orgTalentpilotId = (team.organization as typeof team.organization & { talentpilotOrgId: number | null }).talentpilotOrgId;

    // 2. Ensure org + team exist in TalentPilot
    const needsOrgTeamSetup = !orgTalentpilotId || !talentpilotTeamId;

    if (needsOrgTeamSetup) {
        const provisionOrgTeamRes = await fetch(`${TALENTPILOT_API_URL}/api/external/v1/provision/org-team`, {
            method: 'POST',
            headers: { 'X-API-Key': TALENTPILOT_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                org_name: team.organization.name,
                org_id: orgTalentpilotId ?? undefined,
                team_name: team.name,
                team_id: talentpilotTeamId ?? undefined,
            }),
        });

        if (!provisionOrgTeamRes.ok) {
            const err = await provisionOrgTeamRes.text();
            return NextResponse.json({ error: 'Failed to provision org/team', detail: err }, { status: 502 });
        }

        const orgTeamData = await provisionOrgTeamRes.json() as { org_id: number; team_id: number };

        // Save IDs back to DB
        await prisma.organization.update({
            where: { id: team.organizationId },
            data: { talentpilotOrgId: orgTeamData.org_id },
        });
        await prisma.team.update({
            where: { id: teamId },
            data: { talentpilotTeamId: orgTeamData.team_id },
        });

        talentpilotTeamId = orgTeamData.team_id;
        const finalOrgId = orgTeamData.org_id;

        // Re-assign for provision users call
        (team.organization as any).talentpilotOrgId = finalOrgId;
    }

    const finalOrgId = orgTalentpilotId
        ?? (team.organization as any).talentpilotOrgId as number;

    if (membersWithEmail.length === 0) {
        return NextResponse.json({
            provisioned: 0,
            skipped: membersWithoutEmail.map(m => ({ name: m.name, reason: 'no email' })),
            results: [],
        });
    }

    // 3. Provision users
    const usersPayload = membersWithEmail.map(member => ({
        email: member.email!,
        full_name: member.name,
        talents: member.results.length > 0
            ? member.results.map(r => ({ talent_code: r.talent, rank: r.rank }))
            : undefined,
    }));

    const provisionRes = await fetch(`${TALENTPILOT_API_URL}/api/external/v1/provision/users`, {
        method: 'POST',
        headers: { 'X-API-Key': TALENTPILOT_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            org_id: finalOrgId,
            team_id: talentpilotTeamId,
            users: usersPayload,
        }),
    });

    if (!provisionRes.ok) {
        const err = await provisionRes.text();
        return NextResponse.json({ error: 'Failed to provision users', detail: err }, { status: 502 });
    }

    const provisionData = await provisionRes.json();

    return NextResponse.json({
        provisioned: provisionData.created + provisionData.existing,
        skipped: membersWithoutEmail.map(m => ({ name: m.name, reason: 'no email' })),
        ...provisionData,
    });
}
