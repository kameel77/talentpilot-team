import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY;

export async function POST(req: NextRequest) {
    if (!EXTERNAL_API_KEY) {
        return NextResponse.json({ error: 'EXTERNAL_API_KEY is not configured on the server.' }, { status: 500 });
    }

    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== EXTERNAL_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { organization_id, organization_name, team_id, team_name, users } = body;

        if (!organization_id || !organization_name || !team_id || !team_name || !Array.isArray(users)) {
            return NextResponse.json({ error: 'Missing required payload fields' }, { status: 400 });
        }

        // 1. Upsert Organization
        let org = await prisma.organization.findFirst({ where: { talentpilotOrgId: organization_id } });
        if (org) {
            org = await prisma.organization.update({
                where: { id: org.id },
                data: { name: organization_name }
            });
        } else {
            org = await prisma.organization.create({
                data: { name: organization_name, talentpilotOrgId: organization_id }
            });
        }

        // 2. Upsert Team
        let presentationToken: string;
        let team = await prisma.team.findFirst({ where: { talentpilotTeamId: team_id } });
        if (team) {
            team = await prisma.team.update({
                where: { id: team.id },
                data: { name: team_name, organizationId: org.id }
            });
            if (team.presentationToken) {
                presentationToken = team.presentationToken;
            } else {
                presentationToken = crypto.randomBytes(16).toString('hex');
                await prisma.team.update({ where: { id: team.id }, data: { presentationToken } });
            }
        } else {
            presentationToken = crypto.randomBytes(16).toString('hex');
            team = await prisma.team.create({
                data: {
                    name: team_name,
                    organizationId: org.id,
                    talentpilotTeamId: team_id,
                    presentationToken
                }
            });
        }

        // 3. Sync Members & Talents
        // For simplicity and to ensure accuracy, we will wipe existing members for this team and recreate them
        await prisma.member.deleteMany({ where: { teamId: team.id } });

        const membersToCreate = users.map((user: any) => ({
            name: user.full_name,
            email: user.email,
            role: user.role || 'Member',
            isLeader: user.role === 'manager' || user.role === 'admin',
            teamId: team.id,
            results: {
                create: (user.talents || []).map((t: any) => ({
                    rank: t.rank,
                    talent: t.talent_code,
                    domain: t.domain
                }))
            }
        }));

        for (const memberData of membersToCreate) {
            await prisma.member.create({
                data: memberData
            });
        }

        // Return the presentation public URL
        // Using relative link format matching Matrix routes
        return NextResponse.json({
            message: 'Matrix successfully imported and synchronized',
            url: `/pl/matrix/${presentationToken}`
        }, { status: 200 });

    } catch (error: any) {
        console.error('Import Matrix Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
