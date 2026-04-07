'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useApi } from '@/lib/auth-context';
import { GALLUP_TALENTS, getDomainStyle, DOMAIN_LABELS, type GallupDomain, getTalentsByDomain } from '@/lib/gallup-data';
import { teamTalentRanks, dominantDomain, teamDomainScores, findTeamWeaknesses, findSPOF, checkDomainSpecialist } from '@/lib/team-algorithms';
import {
    Plus, Upload, ArrowLeft, Trash2, UserPlus, X,
    BarChart3, Grid3x3, PieChart, Edit2, Check,
    ChevronDown, ExternalLink, Presentation, AlertTriangle, Star, TrendingDown, ShieldAlert
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
    const tp = useTranslations('Presentation');
    const locale = useLocale();
    const { apiFetch, apiUpload } = useApi();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);

    const [team, setTeam] = useState<TeamData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddMember, setShowAddMember] = useState(false);
    const [memberForm, setMemberForm] = useState({ name: '', email: '', role: '' });
    const [parsedTalents, setParsedTalents] = useState<{ talent: string, rank: number, domain: string }[] | null>(null);
    const [parsingPdf, setParsingPdf] = useState(false);
    const addMemberPdfInputRef = useRef<HTMLInputElement>(null);
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'matrix' | 'domains' | 'profiles'>('matrix');
    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [membersExpanded, setMembersExpanded] = useState(false);
    const [showTop10Domains, setShowTop10Domains] = useState(true);
    const [showTop10Profiles, setShowTop10Profiles] = useState(true);
    const [editingMember, setEditingMember] = useState<{ id: string, name: string, email: string, role: string } | null>(null);
    const [editingTalent, setEditingTalent] = useState<{ memberId: string, talentCode: string, currentRank?: number | null, domain: string } | null>(null);
    const [talentRankInput, setTalentRankInput] = useState('');

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
            body: JSON.stringify({ ...memberForm, teamId, talents: parsedTalents }),
        });
        setShowAddMember(false);
        setMemberForm({ name: '', email: '', role: '' });
        setParsedTalents(null);
        fetchTeam();
    };

    const handleParseGallup = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setParsingPdf(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await apiUpload('/api/gallup/parse', fd);
            if (res.ok) {
                const data = await res.json();
                if (data.person?.first_name || data.person?.last_name) {
                    setMemberForm(prev => ({
                        ...prev,
                        name: `${data.person.first_name || ''} ${data.person.last_name || ''}`.trim()
                    }));
                }
                if (data.talents) {
                    setParsedTalents(data.talents);
                }
            } else {
                alert(t('error'));
            }
        } catch {
             alert(t('error'));
        } finally {
            setParsingPdf(false);
            if (addMemberPdfInputRef.current) addMemberPdfInputRef.current.value = '';
        }
    };

    const deleteMember = async (id: string) => {
        if (!confirm('Delete this member?')) return;
        await apiFetch(`/api/members/${id}`, { method: 'DELETE' });
        fetchTeam();
    };

    const handleEditMemberSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMember) return;
        await apiFetch(`/api/members/${editingMember.id}`, {
            method: 'PUT',
            body: JSON.stringify({ name: editingMember.name, email: editingMember.email, role: editingMember.role }),
        });
        setEditingMember(null);
        fetchTeam();
    };

    const handleEditTalentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTalent) return;
        const rank = parseInt(talentRankInput, 10);
        if (isNaN(rank) || rank < 1 || rank > 34) {
            alert('Rank must be between 1 and 34');
            return;
        }
        await apiFetch(`/api/members/${editingTalent.memberId}/talents`, {
            method: 'PUT',
            body: JSON.stringify({ talentCode: editingTalent.talentCode, rank, domain: editingTalent.domain }),
        });
        setEditingTalent(null);
        setTalentRankInput('');
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

    const handleSaveName = async () => {
        if (!editNameValue.trim() || editNameValue === team?.name) {
            setIsEditingName(false);
            return;
        }
        await apiFetch(`/api/teams/${teamId}`, {
            method: 'PUT',
            body: JSON.stringify({ name: editNameValue })
        });
        setIsEditingName(false);
        fetchTeam();
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

    const openPresentation = async () => {
        try {
            const res = await apiFetch(`/api/teams/${teamId}/presentation-token`, { method: 'POST' });
            const data = await res.json();
            if (data.token) {
                const membersParam = selectedMembers.size === 0
                    ? 'none'
                    : selectedMembers.size === team?.members.filter(m => m.results.length > 0).length
                        ? 'all'
                        : Array.from(selectedMembers).join(',');
                window.open(`/${locale}/matrix/${data.token}?members=${membersParam}`, '_blank');
            }
        } catch (err) {
            console.error('Failed to generate presentation token:', err);
        }
    };

    const toggleMemberSelection = (id: string) => {
        setSelectedMembers(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (!team) return;
        const membersWithData = team.members.filter(m => m.results.length > 0);
        if (selectedMembers.size === membersWithData.length) {
            setSelectedMembers(new Set());
        } else {
            setSelectedMembers(new Set(membersWithData.map(m => m.id)));
        }
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

    // Talent lookup maps
    const talentDomainMap: Record<string, GallupDomain> = {};
    GALLUP_TALENTS.forEach(t => { talentDomainMap[t.code] = t.domain; });
    const talentsByDomainMap: Record<GallupDomain, string[]> = {
        executing: getTalentsByDomain('executing').map(t => t.code),
        influencing: getTalentsByDomain('influencing').map(t => t.code),
        relationship_building: getTalentsByDomain('relationship_building').map(t => t.code),
        strategic_thinking: getTalentsByDomain('strategic_thinking').map(t => t.code),
    };

    // Pie chart: count talents per domain in team's Top N
    const teamTopN = teamRanks.filter(tr => tr.teamRank <= (showTop10Domains ? 10 : 5));
    const domainCounts: Record<GallupDomain, number> = {
        executing: 0, influencing: 0, relationship_building: 0, strategic_thinking: 0,
    };
    teamTopN.forEach(tr => {
        const talent = GALLUP_TALENTS.find(t => t.code === tr.talent);
        if (talent) domainCounts[talent.domain]++;
    });
    const domainCountData = (Object.entries(domainCounts) as [GallupDomain, number][])
        .filter(([_, count]) => count > 0)
        .map(([domain, count]) => ({
            name: DOMAIN_LABELS[domain][locale as 'en' | 'pl'],
            value: count,
            color: getDomainStyle(domain),
        }));

    // Radar chart: weighted domain strength scores
    const domainScores = membersRankMaps.length > 0
        ? teamDomainScores(membersRankMaps, talentsByDomainMap)
        : [];
    const radarData = domainScores.map(ds => ({
        domain: DOMAIN_LABELS[ds.domain][locale as 'en' | 'pl'],
        value: Math.max(0, Math.round(ds.score * 10) / 10),
        score: ds.score,
        color: getDomainStyle(ds.domain),
    }));

    // P1: Team weaknesses
    const teamWeaknesses = membersRankMaps.length > 0
        ? findTeamWeaknesses(membersRankMaps, talentCodes)
        : [];

    // P1: SPOF detection
    const spofList = membersRankMaps.length > 0
        ? findSPOF(membersRankMaps, talentCodes)
        : [];

    // Top talents summary
    const talentTop10Counts: Record<string, number> = {};
    membersWithResults.forEach(m => {
        m.results.filter(r => r.rank <= 10).forEach(r => {
            talentTop10Counts[r.talent] = (talentTop10Counts[r.talent] || 0) + 1;
        });
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isEditingName ? (
                                <>
                                    <input
                                        autoFocus
                                        className="input"
                                        style={{ fontSize: 24, fontWeight: 700, padding: '4px 8px', height: 'auto', width: 'auto' }}
                                        value={editNameValue}
                                        onChange={e => setEditNameValue(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                                    />
                                    <button className="btn btn-ghost" style={{ padding: 8 }} onClick={handleSaveName}>
                                        <Check size={18} />
                                    </button>
                                    <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => setIsEditingName(false)}>
                                        <X size={18} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <h1 className="page-title">{team.name}</h1>
                                    <button className="btn btn-ghost" style={{ padding: 6, border: 'none' }} onClick={() => { setEditNameValue(team.name); setIsEditingName(true); }}>
                                        <Edit2 size={16} />
                                    </button>
                                </>
                            )}
                        </div>
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
                    <button className="btn btn-primary" onClick={openPresentation}
                        style={{ background: `linear-gradient(135deg, ${getDomainStyle('relationship_building')}, ${getDomainStyle('strategic_thinking')})` }}>
                        <Presentation size={18} /> {tp('title')}
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
                                                color: getDomainStyle(talent.domain),
                                                borderBottom: `3px solid ${getDomainStyle(talent.domain)}`,
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
                                                    const isMissing = !rank;

                                                    const bg = isMissing ? 'transparent'
                                                        : rank >= 30 ? 'var(--text-secondary)'
                                                        : getDomainStyle(talent.domain, rank <= 5 ? 100 : rank <= 10 ? 75 : 20);
                                                    const textColor = isMissing ? 'var(--text-secondary)'
                                                        : rank >= 30 ? 'var(--bg-primary)'
                                                        : rank <= 10 ? '#fff' : 'var(--text-primary)';

                                                    return (
                                                        <td 
                                                            key={talent.code} 
                                                            style={{ textAlign: 'center', padding: '4px 2px', cursor: 'pointer' }}
                                                            onClick={() => {
                                                                setEditingTalent({ memberId: member.id, talentCode: talent.code, currentRank: rank, domain: talent.domain });
                                                                setTalentRankInput(rank ? rank.toString() : '');
                                                            }}
                                                            title={isMissing ? t('addTalentClick') || "Click to add talent number" : t('editTalentClick') || "Click to edit talent number"}
                                                        >
                                                            <div className="talent-cell hover-scale" style={{
                                                                background: bg,
                                                                color: textColor,
                                                                margin: '0 auto',
                                                                fontWeight: (rank && (rank <= 10 || rank >= 30)) ? 700 : 500,
                                                                border: isMissing ? '1px dashed var(--border-color)' : 'none',
                                                            }}>
                                                                {isMissing ? '+' : rank}
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
                                                    : getDomainStyle(talent.domain, rank <= 5 ? 100 : rank <= 10 ? 75 : 20);
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
                                                        background: count >= 2 ? getDomainStyle(talent.domain, 80) : count === 1 ? getDomainStyle(talent.domain, 25) : 'transparent',
                                                        color: count >= 2 ? '#fff' : count === 1 ? getDomainStyle(talent.domain) : 'var(--text-muted)',
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Top row: Pie - Rank Tags - Radar */}
                    <div style={{ display: 'grid', gridTemplateColumns: '4fr 2fr 4fr', gap: 20 }}>
                        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 600 }}>
                                    {tt('domainCount')} {showTop10Domains ? tt('top10') : tt('top5')}
                                </h3>
                                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: 4, borderRadius: 8 }}>
                                    <button
                                        className={`btn ${!showTop10Domains ? 'btn-primary' : 'btn-ghost'}`}
                                        style={{ padding: '4px 12px', fontSize: 12, minHeight: 0, height: 28 }}
                                        onClick={() => setShowTop10Domains(false)}
                                    >
                                        Top 5
                                    </button>
                                    <button
                                        className={`btn ${showTop10Domains ? 'btn-primary' : 'btn-ghost'}`}
                                        style={{ padding: '4px 12px', fontSize: 12, minHeight: 0, height: 28 }}
                                        onClick={() => setShowTop10Domains(true)}
                                    >
                                        Top 10
                                    </button>
                                </div>
                            </div>
                            {membersWithResults.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <RePieChart>
                                        <Pie data={domainCountData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                            outerRadius={100} innerRadius={50} paddingAngle={3} strokeWidth={0}>
                                            {domainCountData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                        <Legend iconType="circle" />
                                    </RePieChart>
                                </ResponsiveContainer>
                            ) : <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No data</p>}
                        </div>

                        {/* Team Rank Tag List */}
                        <div className="glass-card" style={{ padding: 24 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                                {tt('teamRankList')}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {teamTopN.map(tr => {
                                    const talent = GALLUP_TALENTS.find(t => t.code === tr.talent);
                                    if (!talent) return null;
                                    return (
                                        <div key={tr.talent} className={`domain-badge ${talent.domain}`} style={{ padding: '4px 10px', fontSize: 11 }}>
                                            #{tr.teamRank} {talent[locale as 'en' | 'pl']}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="glass-card" style={{ padding: 24 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{tt('domainStrength')} — Radar</h3>
                            {membersWithResults.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={100}>
                                        <PolarGrid stroke="var(--border-color)" />
                                        <PolarAngleAxis
                                            dataKey="domain"
                                            tick={(props: any) => {
                                                const item = radarData.find(d => d.domain === props.payload.value);
                                                return (
                                                    <text x={props.x} y={props.y} textAnchor={props.textAnchor} fill={item?.color || 'var(--text-secondary)'} fontSize={12} fontWeight={600} dy={props.y > 150 ? 12 : -4}>
                                                        {props.payload.value}
                                                    </text>
                                                );
                                            }}
                                        />
                                        <PolarRadiusAxis tick={false} axisLine={false} />
                                        <Radar dataKey="value" stroke="var(--text-secondary)" fill="var(--text-secondary)" fillOpacity={0.3} strokeWidth={2} />
                                        <Tooltip content={({ active, payload }: any) => {
                                            if (!active || !payload?.[0]) return null;
                                            const p = payload[0].payload;
                                            return (
                                                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)' }}>
                                                    <div style={{ fontWeight: 600 }}>{p.domain}</div>
                                                    <div>{p.score} {tt('pts')}</div>
                                                </div>
                                            );
                                        }} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            ) : <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No data</p>}
                        </div>
                    </div>

                    {/* Bottom sections */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
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

                    {/* P1: Team Weaknesses */}
                    <div className="glass-card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <TrendingDown size={18} style={{ color: '#ef4444' }} />
                            <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tt('teamWeaknesses')}</h3>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                            {tt('teamWeaknessesDesc')}
                        </p>
                        {teamWeaknesses.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {teamWeaknesses.slice(0, 10).map(w => {
                                    const talent = GALLUP_TALENTS.find(t => t.code === w.talentCode);
                                    if (!talent) return null;
                                    return (
                                        <div key={w.talentCode} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ flex: '0 0 130px', fontSize: 13, fontWeight: 600, color: getDomainStyle(talent.domain) }}>
                                                {talent[locale as 'en' | 'pl']}
                                            </div>
                                            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                                                <div style={{ width: `${w.percentage}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #ef4444, #dc2626)' }} />
                                            </div>
                                            <div style={{ flex: '0 0 70px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                                                {w.percentage}% {tt('ofTeam')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>✅ {tt('noWeaknesses')}</p>}
                    </div>

                    {/* P1: SPOF Alerts */}
                    <div className="glass-card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <ShieldAlert size={18} style={{ color: '#f59e0b' }} />
                            <h3 style={{ fontSize: 16, fontWeight: 600 }}>{tt('spofAlerts')}</h3>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                            {tt('spofAlertsDesc')}
                        </p>
                        {spofList.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {spofList.slice(0, 10).map(spof => {
                                    const talent = GALLUP_TALENTS.find(t => t.code === spof.talentCode);
                                    const carrier = membersWithResults[spof.memberIndex];
                                    if (!talent || !carrier) return null;
                                    return (
                                        <div key={spof.talentCode} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '8px 12px', borderRadius: 8,
                                            background: 'color-mix(in srgb, #f59e0b 8%, transparent)',
                                            border: '1px solid color-mix(in srgb, #f59e0b 20%, transparent)',
                                        }}>
                                            <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: getDomainStyle(talent.domain) }}>
                                                    {talent[locale as 'en' | 'pl']}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                                    {tt('soleCarrier')}: {carrier.name} (#{spof.memberRank})
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>✅ {tt('noSpof')}</p>}
                    </div>
                    </div>
                </div>
            )}

            {activeTab === 'profiles' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                        <div style={{ display: 'inline-flex', gap: 4, background: 'var(--bg-card)', padding: 4, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                            <button
                                className={`btn ${!showTop10Profiles ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ padding: '4px 12px', fontSize: 13, minHeight: 0, height: 32 }}
                                onClick={() => setShowTop10Profiles(false)}
                            >
                                Top 5
                            </button>
                            <button
                                className={`btn ${showTop10Profiles ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ padding: '4px 12px', fontSize: 13, minHeight: 0, height: 32 }}
                                onClick={() => setShowTop10Profiles(true)}
                            >
                                Top 10
                            </button>
                        </div>
                    </div>
                    <div className="cards-grid">
                        {membersWithResults.map(member => {
                            const topN = member.results.filter(r => r.rank <= (showTop10Profiles ? 10 : 5));
                            const domainProfile: Record<GallupDomain, number> = {
                                executing: 0, influencing: 0, relationship_building: 0, strategic_thinking: 0,
                            };
                            topN.forEach(r => {
                                const d = r.domain as GallupDomain;
                                if (domainProfile[d] !== undefined) domainProfile[d]++;
                            });
                            const topDomain = Object.entries(domainProfile).sort((a, b) => b[1] - a[1])[0];

                            // Domain Specialist check
                            const memberRM: Record<string, number> = {};
                            member.results.forEach(r => { memberRM[r.talent] = r.rank; });
                            const specialist = checkDomainSpecialist(memberRM, talentCodes, talentDomainMap);

                            return (
                                <div key={member.id} className="glass-card" style={{ padding: 24 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <div>
                                            <h3 style={{ fontSize: 14, fontWeight: 600 }}>{member.name}</h3>
                                            {member.role && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{member.role}</p>}
                                        </div>
                                        <div style={{ position: 'relative', display: 'inline-flex' }}>
                                            <div className={`domain-badge ${topDomain[0]}`} style={{ fontSize: 10, padding: '3px 8px' }}>
                                                {DOMAIN_LABELS[topDomain[0] as GallupDomain][locale as 'en' | 'pl']}
                                            </div>
                                            {specialist.isSpecialist && (
                                                <span
                                                    className="specialist-star"
                                                    data-tooltip={tt('specialistTooltip')}
                                                    style={{
                                                        position: 'absolute', top: -6, right: -8,
                                                        cursor: 'help',
                                                        color: getDomainStyle(topDomain[0] as GallupDomain),
                                                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
                                                    }}
                                                >
                                                    <Star size={14} fill="currentColor" />
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: 16 }}>
                                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                            {showTop10Profiles ? tt('top10') : tt('top5')}
                                        </p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {topN.map(r => {
                                                const talent = GALLUP_TALENTS.find(t => t.code === r.talent);
                                                return talent ? (
                                                    <span key={r.id} style={{
                                                        padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                                        background: getDomainStyle(talent.domain, 20),
                                                        color: getDomainStyle(talent.domain),
                                                        border: `1px solid ${getDomainStyle(talent.domain, 25)}`,
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
                                                background: count ? getDomainStyle(d) : getDomainStyle(d, 15),
                                                transition: 'flex 0.3s ease',
                                            }} title={`${DOMAIN_LABELS[d][locale as 'en' | 'pl']}: ${count}`} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Members list with upload — collapsible */}
            <div className="glass-card" style={{ marginTop: 24 }}>
                <div className="collapsible-header" onClick={() => setMembersExpanded(!membersExpanded)}>
                    <h3>
                        {tp('teamMembers')}
                        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
                            ({team.members.length})
                            {selectedMembers.size > 0 && (
                                <span style={{ color: 'var(--accent-primary)', marginLeft: 8 }}>
                                    · {selectedMembers.size} {locale === 'pl' ? 'wybranych' : 'selected'}
                                </span>
                            )}
                        </span>
                    </h3>
                    <ChevronDown size={20} className={`collapsible-chevron ${membersExpanded ? 'open' : ''}`} />
                </div>
                <div className={`collapsible-body ${membersExpanded ? 'open' : ''}`}>
                    {/* Select all / Deselect all */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }}
                            onClick={toggleSelectAll}>
                            {selectedMembers.size === team.members.filter(m => m.results.length > 0).length
                                ? tp('deselectAll')
                                : tp('selectAll')
                            }
                        </button>
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 40, textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        className="member-select-checkbox"
                                        checked={team.members.filter(m => m.results.length > 0).length > 0 &&
                                            selectedMembers.size === team.members.filter(m => m.results.length > 0).length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th>{t('name')}</th>
                                <th>{t('role')}</th>
                                <th>Talents</th>
                                <th>{tc('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {team.members.map(member => (
                                <tr key={member.id}>
                                    <td style={{ textAlign: 'center' }}>
                                        {member.results.length > 0 && (
                                            <input
                                                type="checkbox"
                                                className="member-select-checkbox"
                                                checked={selectedMembers.has(member.id)}
                                                onChange={() => toggleMemberSelection(member.id)}
                                            />
                                        )}
                                    </td>
                                    <td style={{ fontWeight: 500 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="member-name-row">
                                            <span>{member.name}</span>
                                            <button 
                                                className="btn btn-ghost edit-member-icon" 
                                                style={{ padding: 4, height: 'auto', minHeight: 0, opacity: 0, transition: 'opacity 0.2s' }}
                                                onClick={() => setEditingMember({ id: member.id, name: member.name, email: member.email || '', role: member.role || '' })}
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                    </td>
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
            </div>

            {/* Upload status toast */}
            {uploadStatus && (
                <div className={`toast ${uploadStatus.includes(t('success')) ? 'success' : uploadStatus.includes(t('error')) ? 'error' : 'success'}`}>
                    {uploadStatus}
                </div>
            )}

            {/* Add member modal */}
            {showAddMember && (
                <div className="modal-overlay" onClick={() => { setShowAddMember(false); setParsedTalents(null); }}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="modal-title">{t('add')}</h2>
                            <button onClick={() => { setShowAddMember(false); setParsedTalents(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={addMember}>
                            <div style={{ marginBottom: 16, padding: '16px', borderRadius: '8px', border: '1px dashed var(--border-color)', background: 'var(--bg-card)', textAlign: 'center' }}>
                                <input type="file" accept="application/pdf" ref={addMemberPdfInputRef} style={{ display: 'none' }} onChange={handleParseGallup} />
                                <button type="button" className="btn btn-ghost" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', height: '40px', alignItems: 'center' }} onClick={() => addMemberPdfInputRef.current?.click()} disabled={parsingPdf}>
                                    {parsingPdf ? <div style={{ width: 16, height: 16, border: '2px solid var(--text-secondary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
                                    {parsingPdf ? t('processing') : t('uploadGallup')}
                                </button>
                                {parsedTalents && parsedTalents.length > 0 && <p style={{ fontSize: 13, color: 'var(--success)', marginTop: 12 }}>✓ {parsedTalents.length} talents extracted successfully</p>}
                            </div>
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
                                <button type="button" className="btn btn-ghost" onClick={() => { setShowAddMember(false); setParsedTalents(null); }}>{tc('cancel')}</button>
                                <button type="submit" className="btn btn-primary">{tc('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit member modal */}
            {editingMember && (
                <div className="modal-overlay" onClick={() => setEditingMember(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="modal-title">{t('edit') || 'Edit Member'}</h2>
                            <button onClick={() => setEditingMember(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleEditMemberSubmit}>
                            <div style={{ marginBottom: 16 }}>
                                <label className="label">{t('name')} *</label>
                                <input className="input" value={editingMember.name} onChange={e => setEditingMember({ ...editingMember, name: e.target.value })} required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div>
                                    <label className="label">{t('email')}</label>
                                    <input className="input" type="email" value={editingMember.email} onChange={e => setEditingMember({ ...editingMember, email: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">{t('role')}</label>
                                    <input className="input" value={editingMember.role} onChange={e => setEditingMember({ ...editingMember, role: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setEditingMember(null)}>{tc('cancel')}</button>
                                <button type="submit" className="btn btn-primary">{tc('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit talent modal */}
            {editingTalent && (
                <div className="modal-overlay" onClick={() => setEditingTalent(null)}>
                    <div className="modal-content" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="modal-title">
                                {tt('editTalent') || 'Edit Talent Number'}
                            </h2>
                            <button onClick={() => setEditingTalent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                            {GALLUP_TALENTS.find(t => t.code === editingTalent.talentCode)?.[locale as 'en' | 'pl']}
                        </p>
                        <form onSubmit={handleEditTalentSubmit}>
                            <div style={{ marginBottom: 16 }}>
                                <label className="label">{tt('rank') || 'Rank (1-34)'} *</label>
                                <input 
                                    className="input" 
                                    type="number" 
                                    min="1" 
                                    max="34" 
                                    value={talentRankInput} 
                                    onChange={e => setTalentRankInput(e.target.value)} 
                                    required 
                                    autoFocus
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setEditingTalent(null)}>{tc('cancel')}</button>
                                <button type="submit" className="btn btn-primary">{tc('save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <style jsx>{`
                .member-name-row:hover .edit-member-icon {
                    opacity: 1 !important;
                }
                .hover-scale {
                    transition: transform 0.2s;
                }
                .hover-scale:hover {
                    transform: scale(1.1);
                }
            `}</style>
        </div>
    );
}
