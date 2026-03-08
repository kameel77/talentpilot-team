'use client';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import LoginPage from '@/components/LoginPage';
import Sidebar from '@/components/Sidebar';

function AppShell({ children }: { children: React.ReactNode }) {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return (
        <>
            <Sidebar />
            <main className="main-content">{children}</main>
        </>
    );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <AppShell>{children}</AppShell>
        </AuthProvider>
    );
}
