import AppLayout from '@/components/AppLayout';
import TeamDetailContent from '@/components/TeamDetailContent';

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <AppLayout>
            <TeamDetailContent teamId={id} />
        </AppLayout>
    );
}
