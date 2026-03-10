import PresentationContent from '@/components/PresentationContent';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { ThemeProvider } from '@/components/ThemeProvider';

export default async function PresentationPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const messages = await getMessages();

    return (
        <PresentationContent token={token} />
    );
}
