'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useApi } from '@/lib/auth-context';
import { Link } from '@/i18n/routing';
import { Plus, Users, X } from 'lucide-react';

interface TeamItem {
    id: string;
    name: string;
    organization: { name: string };
    _count: { members: number };
}

interface OrgOption {
    id: string;
    name: string;
}

export default function TeamsContent() {
    const t = useTranslations('Team');
    const tc = useTranslations('Common');
    const { apiFetch } = useApi();
    const [teams, setTeams] = useState<TeamItem[]>([]);
    const [orgs, setOrgs] = useState<OrgOption[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', organizationId: '' });
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        const [teamsRes, orgsRes] = await Promise.all([
            apiFetch('/api/teams'),
            apiFetch('/api/organizations'),
        ]);
        setTeams(await teamsRes.json());
        setOrgs(await orgsRes.json());
        setLoading(false);
    }, [apiFetch]);

    useEffect(() => { fetchData(); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await apiFetch('/api/teams', { method: 'POST', body: JSON.stringify(form) });
        setShowModal(false);
        setForm({ name: '', organizationId: '' });
        fetchData();
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{tc('teams')}</h1>
                    <p className="page-subtitle">Manage and analyze your teams</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={18} /> {t('add')}
                </button>
            </div>

            {loading ? (
                <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
            ) : teams.length === 0 ? (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                    <Users size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>{t('noTeams')}</p>
                    <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>{t('add')}</button>
                </div>
            ) : (
                <div className="cards-grid">
                    {teams.map(team => (
                        <Link key={team.id} href={`/teams/${team.id}`} style={{ textDecoration: 'none' }}>
                            <div className="glass-card" style={{ padding: 24, cursor: 'pointer' }}>
                                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{team.name}</h3>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{team.organization.name}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                                    <Users size={16} />
                                    <span>{team._count.members} members</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="modal-title">{t('add')}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: 16 }}>
                                <label className="label">{t('name')} *</label>
                                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <label className="label">{tc('organizations')} *</label>
                                <select
                                    className="input"
                                    value={form.organizationId}
                                    onChange={e => setForm({ ...form, organizationId: e.target.value })}
                                    required
                                >
                                    <option value="">Select organization...</option>
                                    {orgs.map(org => (
                                        <option key={org.id} value={org.id}>{org.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>{tc('cancel')}</button>
                                <button type="submit" className="btn btn-primary">{tc('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
