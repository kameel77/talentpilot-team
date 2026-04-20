import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth, unauthorized } from '@/lib/auth';

const TALENTPILOT_API_URL = process.env.TALENTPILOT_API_URL;
const TALENTPILOT_API_KEY = process.env.TALENTPILOT_API_KEY;

export async function POST(req: NextRequest) {
    const user = verifyAuth(req);
    if (!user) return unauthorized();

    if (!TALENTPILOT_API_URL || !TALENTPILOT_API_KEY) {
        return NextResponse.json({ error: 'TalentPilot API configuration is missing on the server.' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { teamId } = body;

        if (!teamId) {
            return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
        }

        // 1. Fetch team, organization, members and their talents
        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: {
                organization: true,
                members: {
                    include: {
                        results: true
                    }
                }
            }
        });

        if (!team) {
            return NextResponse.json({ error: 'Team not found' }, { status: 404 });
        }

        // 2. Call /v1/provision/org-team
        const orgTeamResponse = await fetch(`${TALENTPILOT_API_URL}/api/external/v1/provision/org-team`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': TALENTPILOT_API_KEY
            },
            body: JSON.stringify({
                org_name: team.organization.name,
                org_id: team.organization.talentpilotOrgId,
                team_name: team.name,
                team_id: team.talentpilotTeamId
            })
        });

        if (!orgTeamResponse.ok) {
            const errorData = await orgTeamResponse.text();
            throw new Error(`Failed to provision org/team: ${errorData}`);
        }

        const orgTeamData = await orgTeamResponse.json();

        // 3. Update local mapping if newly created
        if (orgTeamData.org_created && !team.organization.talentpilotOrgId) {
            await prisma.organization.update({
                where: { id: team.organizationId },
                data: { talentpilotOrgId: orgTeamData.org_id }
            });
        }

        if (orgTeamData.team_created && !team.talentpilotTeamId) {
            await prisma.team.update({
                where: { id: team.id },
                data: { talentpilotTeamId: orgTeamData.team_id }
            });
        }

        // Use the returned IDs for the user provision payload
        const tpOrgId = orgTeamData.org_id;
        const tpTeamId = orgTeamData.team_id;

        // 4. Map members to external users schema
        // Only members with email can be invited, as email is required by external schema
        const usersToProvision = team.members
            .filter(m => m.email) // Need an email for the provision
            .map(member => ({
                email: member.email,
                full_name: member.name,
                talents: member.results.map(r => ({
                    talent_code: r.talent,
                    rank: r.rank
                }))
            }));

        if (usersToProvision.length === 0) {
            return NextResponse.json({ 
                message: 'Org/team created or mapped, but no members with emails found to provision.',
                orgTeamData 
            }, { status: 200 });
        }

        // 5. Call /v1/provision/users
        const usersResponse = await fetch(`${TALENTPILOT_API_URL}/api/external/v1/provision/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': TALENTPILOT_API_KEY
            },
            body: JSON.stringify({
                org_id: tpOrgId,
                team_id: tpTeamId,
                users: usersToProvision
            })
        });

        if (!usersResponse.ok) {
            const errorData = await usersResponse.text();
            throw new Error(`Failed to provision users: ${errorData}`);
        }

        const usersData = await usersResponse.json();

        return NextResponse.json({
            message: 'Successfully exported to TalentPilot',
            orgTeam: orgTeamData,
            users: usersData
        }, { status: 200 });

    } catch (error: any) {
        console.error('Export to TalentPilot Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
