import PresentationContent from '@/components/PresentationContent';
import { prisma } from '@/lib/prisma';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
    const { token } = await params;

    // Fetch team directly to populate title
    const team = await prisma.team.findUnique({
        where: { presentationToken: token },
        select: { name: true }
    });

    const title = team ? `TalentPilot.io | ${team.name} Team Insights` : 'TalentPilot.io | Team Insights';
    const description = team ? `Discover the top talents, domain distribution, and overall team profile for ${team.name}.` : 'Team insights built on Gallup (CliftonStrengths).';

    return {
        title,
        description,
        openGraph: {
            title,
            description,
        },
        robots: {
            index: false,
            follow: false,
        }
    };
}

export default async function PresentationPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;

    return (
        <PresentationContent token={token} />
    );
}
