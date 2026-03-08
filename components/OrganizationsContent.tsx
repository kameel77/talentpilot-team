'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useApi } from '@/lib/auth-context';
import { Link } from '@/i18n/routing';
import { Plus, Building2, Users, Trash2, Edit3, X } from 'lucide-react';

interface Org {
    id: string;
    name: string;
    address: string | null;
    nip: string | null;
    email: string | null;
    teams: { id: string; name: string; _count: { members: number } }[];
}

export default function OrganizationsContent() {
    const t = useTranslations('Org');
    const tc = useTranslations('Common');
    const { apiFetch } = useApi();
    const [orgs, setOrgs] = useState<Org[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editOrg, setEditOrg] = useState<Org | null>(null);
    const [form, setForm] = useState({ name: '', address: '', nip: '', email: '' });
    const [loading, setLoading] = useState(true);

    const fetchOrgs = useCallback(async () => {
        const res = await apiFetch('/api/organizations');
        const data = await res.json();
        setOrgs(data);
        setLoading(false);
    }, [apiFetch]);

    useEffect(() => { fetchOrgs(); }, []);

    const openAdd = () => {
        setEditOrg(null);
        setForm({ name: '', address: '', nip: '', email: '' });
        setShowModal(true);
    };

    const openEdit = (org: Org) => {
        setEditOrg(org);
        setForm({ name: org.name, address: org.address || '', nip: org.nip || '', email: org.email || '' });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editOrg) {
            await apiFetch(`/api/organizations/${editOrg.id}`, { method: 'PUT', body: JSON.stringify(form) });
        } else {
            await apiFetch('/api/organizations', { method: 'POST', body: JSON.stringify(form) });
        }
        setShowModal(false);
        fetchOrgs();
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        await apiFetch(`/api/organizations/${id}`, { method: 'DELETE' });
        fetchOrgs();
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{tc('organizations')}</h1>
                    <p className="page-subtitle">Manage your client organizations</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> {t('add')}</button>
            </div>

            {loading ? (
                <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
            ) : orgs.length === 0 ? (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                    <Building2 size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>{t('noOrgs')}</p>
                    <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>{t('add')}</button>
                </div>
            ) : (
                <div className="cards-grid">
                    {orgs.map(org => (
                        <div key={org.id} className="glass-card" style={{ padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                <div>
                                    <h3 style={{ fontSize: 18, fontWeight: 600 }}>{org.name}</h3>
                                    {org.nip && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>NIP: {org.nip}</p>}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-ghost" style={{ padding: '6px 8px' }} onClick={() => openEdit(org)}><Edit3 size={14} /></button>
                                    <button className="btn btn-danger" style={{ padding: '6px 8px' }} onClick={() => handleDelete(org.id)}><Trash2 size={14} /></button>
                                </div>
                            </div>

                            {org.address && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{org.address}</p>}
                            {org.email && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{org.email}</p>}

                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Users size={16} style={{ color: 'var(--text-secondary)' }} />
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    {org.teams.length} {tc('teams')} · {org.teams.reduce((s, t) => s + t._count.members, 0)} members
                                </span>
                            </div>

                            {org.teams.length > 0 && (
                                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {org.teams.map(team => (
                                        <Link key={team.id} href={`/teams/${team.id}`} style={{
                                            padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                                            background: 'var(--accent-glow)', color: 'var(--accent-secondary)',
                                            border: '1px solid rgba(124, 58, 237, 0.2)', textDecoration: 'none',
                                        }}>
                                            {team.name} ({team._count.members})
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="modal-title">{editOrg ? tc('edit') : t('add')}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: 16 }}>
                                <label className="label">{t('name')} *</label>
                                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <label className="label">{t('address')}</label>
                                <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <label className="label">{t('nip')}</label>
                                    <input className="input" value={form.nip} onChange={e => setForm({ ...form, nip: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">{t('email')}</label>
                                    <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                </div>
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
