'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import { useAuth } from '@/lib/auth-context';
import {
    LayoutDashboard,
    Building2,
    Users,
    LogOut,
    Sparkles,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(true);
    const t = useTranslations('Common');
    const { logout } = useAuth();
    const pathname = usePathname();
    const locale = useLocale();

    useEffect(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        if (saved !== null) {
            setCollapsed(saved === 'true');
        }
    }, []);

    const toggleCollapsed = (newState: boolean) => {
        setCollapsed(newState);
        localStorage.setItem('sidebar-collapsed', String(newState));
    };

    const links = [
        { href: '/' as const, icon: LayoutDashboard, label: t('dashboard') },
        { href: '/organizations' as const, icon: Building2, label: t('organizations') },
        { href: '/teams' as const, icon: Users, label: t('teams') },
    ];

    const isActive = (href: string) => href === '/' ? pathname === `/${locale}` : pathname.includes(href);

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-logo" style={{ justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '24px 12px' : '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Sparkles size={24} style={{ color: 'var(--accent-secondary)' }} />
                    <h1 className="sidebar-title">{t('title')}</h1>
                </div>
                <button
                    onClick={() => toggleCollapsed(!collapsed)}
                    className="sidebar-toggle" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                    {collapsed ? null : <ChevronLeft size={20} />}
                </button>
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

            <div style={{ padding: collapsed ? '16px 8px' : '16px 12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'stretch' }}>
                <div className="lang-switcher" style={{ marginBottom: 12, flexDirection: collapsed ? 'column' : 'row' }}>
                    <Link href={pathname as any} locale="en">
                        <button className={locale === 'en' ? 'active' : ''}>EN</button>
                    </Link>
                    <Link href={pathname as any} locale="pl">
                        <button className={locale === 'pl' ? 'active' : ''}>PL</button>
                    </Link>
                </div>

                {collapsed && (
                    <button onClick={() => toggleCollapsed(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 16 }}>
                        <ChevronRight size={20} />
                    </button>
                )}

                <button className="sidebar-link" onClick={logout} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start' }}>
                    <LogOut size={20} />
                    <span>{t('logout')}</span>
                </button>
            </div>
        </aside>
    );
}
