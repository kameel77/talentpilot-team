'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { useAuth } from '@/lib/auth-context';
import {
    LayoutDashboard,
    Building2,
    Users,
    LogOut,
    Sparkles,
} from 'lucide-react';

export default function Sidebar() {
    const t = useTranslations('Common');
    const { logout } = useAuth();
    const pathname = usePathname();

    const locale = pathname.split('/')[1];

    const links = [
        { href: '/' as const, icon: LayoutDashboard, label: t('dashboard') },
        { href: '/organizations' as const, icon: Building2, label: t('organizations') },
        { href: '/teams' as const, icon: Users, label: t('teams') },
    ];

    const isActive = (href: string) => href === '/' ? pathname === `/${locale}` : pathname.includes(href);

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <Sparkles size={24} style={{ color: 'var(--accent-secondary)' }} />
                <h1>{t('title')}</h1>
            </div>

            <nav className="sidebar-nav">
                {links.map(({ href, icon: Icon, label }) => (
                    <Link
                        key={href}
                        href={href}
                        className={`sidebar-link ${isActive(href) ? 'active' : ''}`}
                    >
                        <Icon size={20} />
                        <span>{label}</span>
                    </Link>
                ))}
            </nav>

            <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border-color)' }}>
                <div className="lang-switcher" style={{ marginBottom: 12 }}>
                    <Link href={pathname.replace(`/${locale}`, '/en')} locale="en">
                        <button className={locale === 'en' ? 'active' : ''}>EN</button>
                    </Link>
                    <Link href={pathname.replace(`/${locale}`, '/pl')} locale="pl">
                        <button className={locale === 'pl' ? 'active' : ''}>PL</button>
                    </Link>
                </div>

                <button className="sidebar-link" onClick={logout} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <LogOut size={20} />
                    <span>{t('logout')}</span>
                </button>
            </div>
        </aside>
    );
}
