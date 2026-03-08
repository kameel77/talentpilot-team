'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useApi } from '@/lib/auth-context';
import { Building2, Users, UserCheck, TrendingUp } from 'lucide-react';

interface OrgData {
    id: string;
    name: string;
    teams: { _count: { members: number } }[];
}

export default function DashboardContent() {
    const t = useTranslations('Common');
    const { apiFetch } = useApi();
    const [orgs, setOrgs] = useState<OrgData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/api/organizations')
            .then(r => r.json())
            .then(data => { setOrgs(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const totalTeams = orgs.reduce((sum, o) => sum + o.teams.length, 0);
    const totalMembers = orgs.reduce(
        (sum, o) => sum + o.teams.reduce((s, t) => s + t._count.members, 0), 0
    );

    const stats = [
        { icon: Building2, label: t('organizations'), value: orgs.length, color: 'var(--domain-executing)' },
        { icon: Users, label: t('teams'), value: totalTeams, color: 'var(--domain-influencing)' },
        { icon: UserCheck, label: 'Members', value: totalMembers, color: 'var(--domain-relationship)' },
        { icon: TrendingUp, label: 'Analyzed', value: totalMembers, color: 'var(--domain-strategic)' },
    ];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('dashboard')}</h1>
                    <p className="page-subtitle">Team Insights Overview</p>
                </div>
            </div>

            {loading ? (
                <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
            ) : (
                <div className="cards-grid">
                    {stats.map(({ icon: Icon, label, value, color }) => (
                        <div key={label} className="glass-card stat-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    background: `${color}22`, display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Icon size={20} style={{ color }} />
                                </div>
                                <span className="stat-label">{label}</span>
                            </div>
                            <div className="stat-value">{value}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
