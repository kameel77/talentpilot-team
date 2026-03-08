'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useApi } from '@/lib/auth-context';
import { GALLUP_TALENTS, DOMAIN_COLORS, DOMAIN_LABELS, type GallupDomain } from '@/lib/gallup-data';
import { teamTalentRanks, dominantDomain } from '@/lib/team-algorithms';
import {
    Plus, Upload, ArrowLeft, Trash2, UserPlus, X,
    BarChart3, Grid3x3, PieChart,
} from 'lucide-react';
import {
    PieChart as RePieChart, Pie, Cell, ResponsiveContainer,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
    Tooltip,
} from 'recharts';
import { Link } from '@/i18n/routing';
import Papa from 'papaparse';

interface TalentResult {
    id: string; rank: number; talent: string; domain: string;
}
interface Member {
    id: string; name: string; email?: string; role?: string;
    results: TalentResult[];
}
interface TeamData {
    id: string; name: string;
    organization: { id: string; name: string };
    members: Member[];
}

export default function TeamDetailContent({ teamId }: { teamId: string }) {
    const t = useTranslations('Member');
    const tt = useTranslations('Talents');
    const tc = useTranslations('Common');
    const locale = useLocale();
    const { apiFetch, apiUpload } = useApi();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);

    const [team, setTeam] = useState<TeamData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberForm, setMemberForm] = useState({ name: '', email: '', role: '' });
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'matrix' | 'domains' | 'profiles'>('matrix');

    const fetchTeam = useCallback(async () => {
        const res = await apiFetch(`/api/teams/${teamId}`);
        const data = await res.json();
        setTeam(data);
        setLoading(false);
    }, [apiFetch, teamId]);

    useEffect(() => { fetchTeam(); }, []);

    const addMember = async (e: React.FormEvent) => {
        e.preventDefault();
        await apiFetch('/api/members', {
            method: 'POST',
            body: JSON.stringify({ ...memberForm, teamId }),
        });
        setShowAddMember(false);
        setMemberForm({ name: '', email: '', role: '' });
        fetchTeam();
    };

    const deleteMember = async (id: string) => {
        if (!confirm('Delete this member?')) return;
        await apiFetch(`/api/members/${id}`, { method: 'DELETE' });
        fetchTeam();
    };

    const handleUpload = async (memberId: string, file: File) => {
        setUploadingFor(memberId);
        setUploadStatus(t('processing'));
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await apiUpload(`/api/members/${memberId}/upload-gallup`, fd);
            if (res.ok) {
                setUploadStatus(t('success'));
                fetchTeam();
            } else {
                const err = await res.json();
                setUploadStatus(`${t('error')}: ${err.error || ''}`);
            }
        } catch {
            setUploadStatus(t('error'));
        }
        setTimeout(() => { setUploadingFor(null); setUploadStatus(null); }, 3000);
    };

    const triggerUpload = (memberId: string) => {
        setUploadingFor(memberId);
        fileInputRef.current?.click();
    };

    const triggerCsvImport = () => {
        csvInputRef.current?.click();
    };

    const handleCsvImport = async (data: any[]) => {
        if (!data || data.length === 0) return;
        setUploadStatus(t('processing'));
        try {
            const members = data.map((row: any) => ({
                name: row.name,
                email: row.email,
                role: row.role,
                teamId
            })).filter(m => m.name);

            if (members.length === 0) {
                setUploadStatus(t('importError'));
                setTimeout(() => setUploadStatus(null), 3000);
                return;
            }

            const res = await apiFetch('/api/members', {
                method: 'POST',
                body: JSON.stringify(members)
            });

            if (res.ok) {
                setUploadStatus(t('importSuccess'));
                fetchTeam();
            } else {
                setUploadStatus(t('importError'));
            }
        } catch {
            setUploadStatus(t('importError'));
        }
        setTimeout(() => setUploadStatus(null), 3000);
    };

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && uploadingFor) handleUpload(uploadingFor, file);
        e.target.value = '';
    };

    const onCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                handleCsvImport(results.data);
            },
            error: () => {
                setUploadStatus(t('importError'));
                setTimeout(() => setUploadStatus(null), 3000);
            }
        });
        e.target.value = '';
    };

    if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>;
    if (!team) return <p>Team not found</p>;

    const membersWithResults = team.members.filter(m => m.results.length > 0);

    // Build rank maps for team algorithm
    const talentCodes = GALLUP_TALENTS.map(t => t.code);
    const membersRankMaps = membersWithResults.map(m => {
        const map: Record<string, number> = {};
        m.results.forEach(r => { map[r.talent] = r.rank; });
        return map;
    });

    // Compute team talent rankings (geometric mean)
    const teamRanks = teamTalentRanks(membersRankMaps, talentCodes);
    const teamRankMap: Record<string, number> = {};
    teamRanks.forEach(tr => { teamRankMap[tr.talent] = tr.teamRank; });

    // Domain distribution based on team talent order's Top 5
    const teamTop5 = teamRanks.filter(tr => tr.teamRank <= 5);
    const domainCounts: Record<GallupDomain, number> = {
        executing: 0, influencing: 0, relationship_building: 0, strategic_thinking: 0,
    };
    teamTop5.forEach(tr => {
        const talent = GALLUP_TALENTS.find(t => t.code === tr.talent);
        if (talent) {
            domainCounts[talent.domain]++;
        }
    });
    const domainData = (Object.entries(domainCounts) as [GallupDomain, number][]).map(([domain, count]) => ({
        name: DOMAIN_LABELS[domain][locale as 'en' | 'pl'],
        value: count,
        color: DOMAIN_COLORS[domain],
    }));

    // Top talents summary
    const talentTop10Counts: Record<string, number> = {};
    membersWithResults.forEach(m => {
        m.results.filter(r => r.rank <= 10).forEach(r => {
            talentTop10Counts[r.talent] = (talentTop10Counts[r.talent] || 0) + 1;
        });
    });

    // Radar data per domain
    const radarData = (Object.keys(DOMAIN_LABELS) as GallupDomain[]).map(domain => {
        const avg = membersWithResults.length > 0
            ? membersWithResults.reduce((sum, m) => {
                const domainTalents = m.results.filter(r => r.domain === domain);
                const avgRank = domainTalents.length > 0
                    ? domainTalents.reduce((s, r) => s + r.rank, 0) / domainTalents.length : 34;
                return sum + (35 - avgRank); // invert so higher is better
            }, 0) / membersWithResults.length
            : 0;
        return {
            domain: DOMAIN_LABELS[domain][locale as 'en' | 'pl'],
            value: Math.round(avg * 10) / 10,
        };
    });

    return (
        <div>
            <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={onFileSelect} />
            <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onCsvSelect} />

            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Link href="/organizations" style={{ color: 'var(--text-secondary)' }}>
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="page-title">{team.name}</h1>
                        <p className="page-subtitle">{team.organization.name} · {team.members.length} members</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost" onClick={triggerCsvImport}>
                        <Upload size={18} /> {t('import')}
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowAddMember(true)}>
                        <UserPlus size={18} /> {t('add')}
                    </button>
                </div>
            </div>

            {/* Tab navigation */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {[
                    { key: 'matrix' as const, icon: Grid3x3, label: tt('matrix') },
                    { key: 'domains' as const, icon: PieChart, label: tt('domains') },
                    { key: 'profiles' as const, icon: BarChart3, label: tt('profile') },
                ].map(({ key, icon: Icon, label }) => (
                    <button
                        key={key}
                        className={`btn ${activeTab === key ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab(key)}
                    >
                        <Icon size={16} /> {label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'matrix' && (
                <div className="glass-card" style={{ padding: 24, overflow: 'auto' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{tt('matrix')}</h3>
                    {membersWithResults.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>
                            No talent data yet. Upload Gallup reports for team members.
                        </p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table" style={{ fontSize: 12 }}>
                                <thead>
                                    <tr>
                                        <th style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', zIndex: 2, minWidth: 140 }}>
                                            {t('name')}
                                        </th>
                                        {GALLUP_TALENTS.map(talent => (
                                            <th key={talent.code} style={{
                                                writingMode: 'vertical-rl', textOrientation: 'mixed',
                                                padding: '8px 4px', textAlign: 'center', minWidth: 32,
                                                color: DOMAIN_COLORS[talent.domain],
                                                borderBottom: `3px solid ${DOMAIN_COLORS[talent.domain]}`,
                                            }}>
                                                {talent[locale as 'en' | 'pl']}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {membersWithResults.map(member => {
                                        const rankMap: Record<string, number> = {};
                                        member.results.forEach(r => { rankMap[r.talent] = r.rank; });
                                        return (
                                            <tr key={member.id}>
                                                <td style={{
                                                    position: 'sticky', left: 0, background: 'var(--bg-card)',
                                                    zIndex: 1, fontWeight: 600, whiteSpace: 'nowrap',
                                                }}>
                                                    {member.name}
                                                </td>
                                                {GALLUP_TALENTS.map(talent => {
                                                    const rank = rankMap[talent.code];
                                                    if (!rank) return <td key={talent.code} style={{ textAlign: 'center' }}>-</td>;

                                                    const bg = rank >= 30
                                                        ? 'var(--text-secondary)'
                                                        : `${DOMAIN_COLORS[talent.domain]}${rank <= 5 ? 'ff' : rank <= 10 ? 'bb' : '33'}`;
                                                    const textColor = rank >= 30
                                                        ? 'var(--bg-primary)'
                                                        : rank <= 10 ? '#fff' : 'var(--text-primary)';

                                                    return (
                                                        <td key={talent.code} style={{ textAlign: 'center', padding: '4px 2px' }}>
                                                            <div className="talent-cell" style={{
                                                                background: bg,
                                                                color: textColor,
                                                                margin: '0 auto',
                                                                fontWeight: rank <= 10 || rank >= 30 ? 700 : 500,
                                                            }}>
                                                                {rank}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                    {/* Spacer row */}
                                    {teamRanks.length > 0 && (
                                        <tr>
                                            <td colSpan={35} style={{ height: '32px', background: 'transparent', border: 'none' }}></td>
                                        </tr>
                                    )}
                                    {/* Team row: team-level talent ranking */}
                                    {teamRanks.length > 0 && (
                                        <tr style={{ borderTop: '2px solid var(--border-accent)' }}>
                                            <td style={{
                                                position: 'sticky', left: 0, background: 'var(--bg-card)',
                                                zIndex: 1, fontWeight: 700, whiteSpace: 'nowrap',
                                            }}>
                                                {tt('teamRow')}
                                            </td>
                                            {GALLUP_TALENTS.map(talent => {
                                                const rank = teamRankMap[talent.code];
                                                if (!rank) return <td key={talent.code} style={{ textAlign: 'center' }}>-</td>;

                                                const bg = rank >= 30
                                                    ? 'var(--text-secondary)'
                                                    : `${DOMAIN_COLORS[talent.domain]}${rank <= 5 ? 'ff' : rank <= 10 ? 'bb' : '33'}`;
                                                const textColor = rank >= 30
                                                    ? 'var(--bg-primary)'
                                                    : rank <= 10 ? '#fff' : 'var(--text-primary)';

                                                return (
                                                    <td key={talent.code} style={{ textAlign: 'center', padding: '4px 2px' }}>
                                                        <div className="talent-cell" style={{
                                                            background: bg,
                                                            color: textColor,
                                                            margin: '0 auto',
                                                            fontWeight: rank <= 10 || rank >= 30 ? 700 : 500,
                                                        }}>
                                                            {rank}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    )}
                                    {/* Summary row: Top 10 counts */}
                                    <tr style={{ borderTop: '2px solid var(--border-accent)' }}>
                                        <td style={{
                                            position: 'sticky', left: 0, background: 'var(--bg-card)',
                                            zIndex: 1, fontWeight: 700, fontSize: 11, textTransform: 'uppercase',
                                        }}>
                                            {tt('top10Summary')}
                                        </td>
                                        {GALLUP_TALENTS.map(talent => {
                                            const count = talentTop10Counts[talent.code] || 0;
                                            return (
                                                <td key={talent.code} style={{ textAlign: 'center', padding: '4px 2px' }}>
                                                    <div style={{
                                                        width: 32, height: 32, margin: '0 auto', borderRadius: 6,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontWeight: 700, fontSize: 13,
                                                        background: count >= 2 ? `${DOMAIN_COLORS[talent.domain]}cc` : count === 1 ? `${DOMAIN_COLORS[talent.domain]}44` : 'transparent',
                                                        color: count >= 2 ? '#fff' : count === 1 ? DOMAIN_COLORS[talent.domain] : 'var(--text-muted)',
                                                    }}>
                                                        {count || ''}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'domains' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div className="glass-card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                            {tt('domains')} (Top 5)
                        </h3>
                        {membersWithResults.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <RePieChart>
                                    <Pie data={domainData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                        outerRadius={100} innerRadius={50} paddingAngle={3} strokeWidth={0}>
                                        {domainData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                    <Legend />
                                </RePieChart>
                            </ResponsiveContainer>
                        ) : <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No data</p>}
                    </div>

                    <div className="glass-card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Team Domain Radar</h3>
                        {membersWithResults.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={100}>
                                    <PolarGrid stroke="var(--border-color)" />
                                    <PolarAngleAxis dataKey="domain" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                    <PolarRadiusAxis tick={false} axisLine={false} />
                                    <Radar dataKey="value" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.3} strokeWidth={2} />
                                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No data</p>}
                    </div>

                    {/* Top talents list */}
                    <div className="glass-card" style={{ padding: 24, gridColumn: '1 / -1' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                            {tt('heatmap')} — Most common in Top 10
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {Object.entries(talentTop10Counts)
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 15)
                                .map(([code, count]) => {
                                    const talent = GALLUP_TALENTS.find(t => t.code === code);
                                    if (!talent) return null;
                                    return (
                                        <div key={code} className={`domain-badge ${talent.domain}`} style={{ padding: '6px 14px' }}>
                                            {talent[locale as 'en' | 'pl']} ({count})
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'profiles' && (
                <div className="cards-grid">
                    {membersWithResults.map(member => {
                        const top5 = member.results.filter(r => r.rank <= 5);
                        const domainProfile: Record<GallupDomain, number> = {
                            executing: 0, influencing: 0, relationship_building: 0, strategic_thinking: 0,
                        };
                        top5.forEach(r => {
                            const d = r.domain as GallupDomain;
                            if (domainProfile[d] !== undefined) domainProfile[d]++;
                        });
                        const topDomain = Object.entries(domainProfile).sort((a, b) => b[1] - a[1])[0];

                        return (
                            <div key={member.id} className="glass-card" style={{ padding: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{member.name}</h3>
                                        {member.role && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{member.role}</p>}
                                    </div>
                                    <div className={`domain-badge ${topDomain[0]}`}>
                                        {DOMAIN_LABELS[topDomain[0] as GallupDomain][locale as 'en' | 'pl']}
                                    </div>
                                </div>

                                <div style={{ marginBottom: 16 }}>
                                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                        {tt('top5')}
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {top5.map(r => {
                                            const talent = GALLUP_TALENTS.find(t => t.code === r.talent);
                                            return talent ? (
                                                <span key={r.id} style={{
                                                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                                    background: `${DOMAIN_COLORS[talent.domain]}33`,
                                                    color: DOMAIN_COLORS[talent.domain],
                                                    border: `1px solid ${DOMAIN_COLORS[talent.domain]}44`,
                                                }}>
                                                    #{r.rank} {talent[locale as 'en' | 'pl']}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 4 }}>
                                    {(Object.entries(domainProfile) as [GallupDomain, number][]).map(([d, count]) => (
                                        <div key={d} style={{
                                            flex: count || 0.2, height: 6, borderRadius: 3,
                                            background: count ? DOMAIN_COLORS[d] : `${DOMAIN_COLORS[d]}22`,
                                            transition: 'flex 0.3s ease',
                                        }} title={`${DOMAIN_LABELS[d][locale as 'en' | 'pl']}: ${count}`} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Members list with upload */}
            <div className="glass-card" style={{ padding: 24, marginTop: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Team Members</h3>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{t('name')}</th>
                            <th>{t('role')}</th>
                            <th>Talents</th>
                            <th>{tc('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {team.members.map(member => (
                            <tr key={member.id}>
                                <td style={{ fontWeight: 500 }}>{member.name}</td>
                                <td style={{ color: 'var(--text-secondary)' }}>{member.role || '—'}</td>
                                <td>
                                    {member.results.length > 0 ? (
                                        <span style={{ color: 'var(--success)', fontSize: 13 }}>
                                            ✓ {member.results.length} talents
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No data</span>
                                    )}
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
                                            onClick={() => triggerUpload(member.id)}>
                                            <Upload size={14} /> {t('uploadGallup')}
                                        </button>
                                        <button className="btn btn-danger" style={{ padding: '4px 8px' }}
                                            onClick={() => deleteMember(member.id)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Upload status toast */}
            {uploadStatus && (
                <div className={`toast ${uploadStatus.includes(t('success')) ? 'success' : uploadStatus.includes(t('error')) ? 'error' : 'success'}`}>
                    {uploadStatus}
                </div>
            )}

            {/* Add member modal */}
            {showAddMember && (
                <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="modal-title">{t('add')}</h2>
                            <button onClick={() => setShowAddMember(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={addMember}>
                            <div style={{ marginBottom: 16 }}>
                                <label className="label">{t('name')} *</label>
                                <input className="input" value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <label className="label">{t('email')}</label>
                                    <input className="input" type="email" value={memberForm.email} onChange={e => setMemberForm({ ...memberForm, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">{t('role')}</label>
                                    <input className="input" value={memberForm.role} onChange={e => setMemberForm({ ...memberForm, role: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowAddMember(false)}>{tc('cancel')}</button>
                                <button type="submit" className="btn btn-primary">{tc('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
