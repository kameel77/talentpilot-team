'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { GALLUP_TALENTS, getDomainStyle, DOMAIN_LABELS, type GallupDomain, getTalentsByDomain } from '@/lib/gallup-data';
import { teamTalentRanks } from '@/lib/team-algorithms';
import { Info, BarChart3, Grid3x3, PieChart as PieChartIcon } from 'lucide-react';
import {
    PieChart as RePieChart, Pie, Cell, ResponsiveContainer,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
    Tooltip,
} from 'recharts';

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

const DOMAIN_ORDER: GallupDomain[] = ['executing', 'influencing', 'relationship_building', 'strategic_thinking'];

const DOMAIN_TOOLTIP_KEYS: Record<GallupDomain, string> = {
    executing: 'domainExecutingDesc',
    influencing: 'domainInfluencingDesc',
    relationship_building: 'domainRelationshipDesc',
    strategic_thinking: 'domainStrategicDesc',
};

const DOMAIN_PRESENTATION_LABELS: Record<GallupDomain, { en: string; pl: string }> = {
    executing: { en: 'EXECUTING', pl: 'WYKONYWANIE' },
    influencing: { en: 'INFLUENCING', pl: 'WPŁYWANIE' },
    relationship_building: { en: 'RELATIONSHIP BUILDING', pl: 'BUDOWANIE RELACJI' },
    strategic_thinking: { en: 'STRATEGIC THINKING', pl: 'MYŚLENIE STRATEGICZNE' },
};

type RankBucket = '1-5' | '6-10' | '11-29' | '30-34';

export default function PresentationContent({ token }: { token: string }) {
    const t = useTranslations('Presentation');
    const tt = useTranslations('Talents');
    const locale = useLocale() as 'en' | 'pl';
    const searchParams = useSearchParams();

    const [team, setTeam] = useState<TeamData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeBuckets, setActiveBuckets] = useState<Set<RankBucket>>(new Set(['1-5', '6-10']));
    const [hoveredDomain, setHoveredDomain] = useState<GallupDomain | null>(null);
    const [activeTab, setActiveTab] = useState<'matrix' | 'domains' | 'profiles'>('matrix');
    const [showTop10Domains, setShowTop10Domains] = useState(false);
    const [showTop10Profiles, setShowTop10Profiles] = useState(false);

    useEffect(() => {
        fetch(`/api/presentations/${token}`)
            .then(res => {
                if (!res.ok) throw new Error('Not found');
                return res.json();
            })
            .then(data => { setTeam(data); setLoading(false); })
            .catch(() => { setError(true); setLoading(false); });
    }, [token]);

    // Parse member selection from query params
    const membersParam = searchParams.get('members');

    const displayMembers = useMemo(() => {
        if (!team) return [];
        const membersWithResults = team.members.filter(m => m.results.length > 0);

        if (!membersParam || membersParam === 'all') return membersWithResults;
        if (membersParam === 'none') return [];

        const selectedIds = new Set(membersParam.split(','));
        return membersWithResults.filter(m => selectedIds.has(m.id));
    }, [team, membersParam]);

    const allMembersWithResults = useMemo(() => {
        if (!team) return [];
        return team.members.filter(m => m.results.length > 0);
    }, [team]);

    const sourceMembers = displayMembers.length > 0 ? displayMembers : allMembersWithResults;

    // Team talent rankings based on visible members
    const talentCodes = GALLUP_TALENTS.map(t => t.code);
    const membersRankMaps = sourceMembers.map(m => {
        const map: Record<string, number> = {};
        m.results.forEach(r => { map[r.talent] = r.rank; });
        return map;
    });
    const teamRanks = membersRankMaps.length > 0 ? teamTalentRanks(membersRankMaps, talentCodes) : [];
    const teamRankMap: Record<string, number> = {};
    teamRanks.forEach(tr => { teamRankMap[tr.talent] = tr.teamRank; });

    // Top 10 counts based on visible members
    const talentTop10Counts: Record<string, number> = {};
    sourceMembers.forEach(m => {
        m.results.filter(r => r.rank <= 10).forEach(r => {
            talentTop10Counts[r.talent] = (talentTop10Counts[r.talent] || 0) + 1;
        });
    });

    // Domain distribution based on visible members team talent order's Top N
    const teamTopN = teamRanks.filter(tr => tr.teamRank <= (showTop10Domains ? 10 : 5));
    const domainCounts: Record<GallupDomain, number> = {
        executing: 0, influencing: 0, relationship_building: 0, strategic_thinking: 0,
    };
    teamTopN.forEach(tr => {
        const talent = GALLUP_TALENTS.find(t => t.code === tr.talent);
        if (talent) {
            domainCounts[talent.domain]++;
        }
    });
    const domainData = (Object.entries(domainCounts) as [GallupDomain, number][])
        .filter(([_, count]) => count > 0)
        .map(([domain, count]) => ({
            name: DOMAIN_LABELS[domain][locale as 'en' | 'pl'],
            value: count,
            color: getDomainStyle(domain),
        }));

    // Radar data per domain based on visible members
    const radarData = (Object.keys(DOMAIN_LABELS) as GallupDomain[]).map(domain => {
        const avg = sourceMembers.length > 0
            ? sourceMembers.reduce((sum, m) => {
                const domainTalents = m.results.filter(r => r.domain === domain);
                const avgRank = domainTalents.length > 0
                    ? domainTalents.reduce((s, r) => s + r.rank, 0) / domainTalents.length : 34;
                return sum + (35 - avgRank); // invert so higher is better
            }, 0) / sourceMembers.length
            : 0;
        return {
            domain: DOMAIN_LABELS[domain][locale as 'en' | 'pl'],
            value: Math.round(avg * 10) / 10,
            color: getDomainStyle(domain),
        };
    });

    // Domain talent counts
    const domainTalentCounts = DOMAIN_ORDER.map(d => getTalentsByDomain(d).length);

    const toggleBucket = (bucket: RankBucket) => {
        setActiveBuckets(prev => {
            const next = new Set(prev);
            if (next.has(bucket)) next.delete(bucket);
            else next.add(bucket);
            return next;
        });
    };

    const isRankVisible = (rank: number): boolean => {
        if (rank >= 1 && rank <= 5) return activeBuckets.has('1-5');
        if (rank >= 6 && rank <= 10) return activeBuckets.has('6-10');
        if (rank >= 11 && rank <= 29) return activeBuckets.has('11-29');
        if (rank >= 30 && rank <= 34) return activeBuckets.has('30-34');
        return false;
    };

    if (loading) return (
        <div className="presentation-page">
            <div className="presentation-loading">{t('loading')}</div>
        </div>
    );
    if (error || !team) return (
        <div className="presentation-page">
            <div className="presentation-loading">{t('notFound')}</div>
        </div>
    );

    const BUCKET_COLORS: Record<RankBucket, string> = {
        '1-5': getDomainStyle('executing'),
        '6-10': getDomainStyle('relationship_building'),
        '11-29': '#94a3b8',
        '30-34': '#475569',
    };

    return (
        <div className="presentation-page">
            {/* Header */}
            <div className="presentation-header">
                <div>
                    <h1 className="presentation-title">{team.name}</h1>
                    <p className="presentation-subtitle">{team.organization.name}</p>
                </div>
            </div>

            {/* Tab navigation */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, padding: '0 24px' }}>
                {[
                    { key: 'matrix' as const, icon: Grid3x3, label: tt('matrix') },
                    { key: 'domains' as const, icon: PieChartIcon, label: tt('domains') },
                    { key: 'profiles' as const, icon: BarChart3, label: tt('profile'), disabled: displayMembers.length === 0 },
                ].map(({ key, icon: Icon, label, disabled }) => (
                    <button
                        key={key}
                        className={`btn ${activeTab === key ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                            if (!disabled) setActiveTab(key);
                        }}
                        style={{
                            opacity: disabled ? 0.5 : 1,
                            cursor: disabled ? 'not-allowed' : 'pointer'
                        }}
                        disabled={disabled}
                    >
                        <Icon size={16} /> {label}
                    </button>
                ))}
            </div>

            {activeTab === 'matrix' && (
                <>
                    {/* Rank filter */}
                    <div className="rank-filters">
                        <span className="rank-filters-label">{t('show')}:</span>
                        {(['1-5', '6-10', '11-29', '30-34'] as RankBucket[]).map(bucket => (
                            <label key={bucket} className="rank-filter-item">
                                <input
                                    type="checkbox"
                                    checked={activeBuckets.has(bucket)}
                                    onChange={() => toggleBucket(bucket)}
                                    style={{ accentColor: BUCKET_COLORS[bucket] }}
                                />
                                <span
                                    className="rank-filter-swatch"
                                    style={{ background: BUCKET_COLORS[bucket] }}
                                />
                                <span>{bucket}</span>
                            </label>
                        ))}
                    </div>

                    {/* Matrix table */}
                    <div className="glass-card presentation-matrix-card">
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table presentation-table" style={{ fontSize: 12 }}>
                                <thead>
                                    {/* Domain header row */}
                                    <tr className="domain-header-row">
                                        <th style={{
                                            position: 'sticky', left: 0, background: 'var(--bg-card)',
                                            zIndex: 3, minWidth: 140, borderBottom: 'none',
                                        }} />
                                        {DOMAIN_ORDER.map((domain, di) => {
                                            const talents = getTalentsByDomain(domain);
                                            return (
                                                <th
                                                    key={domain}
                                                    colSpan={talents.length}
                                                    className="domain-header-cell"
                                                    style={{
                                                        background: getDomainStyle(domain, 10),
                                                        borderBottom: `3px solid ${getDomainStyle(domain)}`,
                                                        textAlign: 'center',
                                                        padding: '12px 8px 8px',
                                                        position: 'relative',
                                                    }}
                                                    onMouseEnter={() => setHoveredDomain(domain)}
                                                    onMouseLeave={() => setHoveredDomain(null)}
                                                >
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        gap: 6, fontWeight: 700, fontSize: 12,
                                                        color: getDomainStyle(domain),
                                                        letterSpacing: '0.08em',
                                                    }}>
                                                        {DOMAIN_PRESENTATION_LABELS[domain][locale]}
                                                        <Info size={13} style={{ opacity: 0.5 }} />
                                                    </div>
                                                    {hoveredDomain === domain && (
                                                        <div className="domain-tooltip">
                                                            {t(DOMAIN_TOOLTIP_KEYS[domain])}
                                                        </div>
                                                    )}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                    {/* Talent names row */}
                                    <tr>
                                        <th style={{
                                            position: 'sticky', left: 0, background: 'var(--bg-card)',
                                            zIndex: 2, minWidth: 140, fontWeight: 600, fontSize: 11,
                                            textTransform: 'uppercase', letterSpacing: '0.05em',
                                        }}>
                                            {t('show') === 'Wyświetl' ? 'Nazwa ▼' : 'Name ▼'}
                                        </th>
                                        {GALLUP_TALENTS.map(talent => (
                                            <th key={talent.code} style={{
                                                writingMode: 'vertical-rl', textOrientation: 'mixed',
                                                padding: '8px 4px', textAlign: 'center', minWidth: 32,
                                                color: getDomainStyle(talent.domain),
                                                fontSize: 11, fontWeight: 500,
                                            }}>
                                                {talent[locale]}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Team rank row */}
                                    {teamRanks.length > 0 && (
                                        <tr className="team-rank-row">
                                            <td style={{
                                                position: 'sticky', left: 0, background: 'var(--bg-card)',
                                                zIndex: 1, fontWeight: 700, whiteSpace: 'nowrap',
                                                fontSize: 11, textTransform: 'uppercase',
                                                borderBottom: '2px solid var(--border-accent)',
                                            }}>
                                                {t('teamRank')}
                                            </td>
                                            {GALLUP_TALENTS.map(talent => {
                                                const rank = teamRankMap[talent.code];
                                                if (!rank) return <td key={talent.code} style={{ textAlign: 'center' }}>-</td>;

                                                const visible = isRankVisible(rank);
                                                const bg = !visible ? 'transparent'
                                                    : rank >= 30 ? 'var(--text-secondary)'
                                                        : getDomainStyle(talent.domain, rank <= 5 ? 100 : rank <= 10 ? 75 : 20);
                                                const textColor = !visible ? 'transparent'
                                                    : rank >= 30 ? 'var(--bg-primary)'
                                                        : rank <= 10 ? '#fff' : 'var(--text-primary)';

                                                return (
                                                    <td key={talent.code} style={{
                                                        textAlign: 'center', padding: '4px 2px',
                                                        borderBottom: '2px solid var(--border-accent)',
                                                    }}>
                                                        {visible && (
                                                            <div className="talent-cell" style={{
                                                                background: bg,
                                                                color: textColor,
                                                                margin: '0 auto',
                                                                fontWeight: rank <= 10 || rank >= 30 ? 700 : 500,
                                                            }}>
                                                                {rank}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    )}

                                    {/* Spacer */}
                                    {displayMembers.length > 0 && (
                                        <tr>
                                            <td colSpan={35} style={{ height: 12, background: 'transparent', border: 'none' }} />
                                        </tr>
                                    )}

                                    {/* Member rows */}
                                    {displayMembers.map(member => {
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

                                                    const visible = isRankVisible(rank);
                                                    const bg = !visible ? 'transparent'
                                                        : rank >= 30 ? 'var(--text-secondary)'
                                                            : getDomainStyle(talent.domain, rank <= 5 ? 100 : rank <= 10 ? 75 : 20);
                                                    const textColor = !visible ? 'transparent'
                                                        : rank >= 30 ? 'var(--bg-primary)'
                                                            : rank <= 10 ? '#fff' : 'var(--text-primary)';

                                                    return (
                                                        <td key={talent.code} style={{ textAlign: 'center', padding: '4px 2px' }}>
                                                            {visible && (
                                                                <div className="talent-cell" style={{
                                                                    background: bg,
                                                                    color: textColor,
                                                                    margin: '0 auto',
                                                                    fontWeight: rank <= 10 || rank >= 30 ? 700 : 500,
                                                                }}>
                                                                    {rank}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}

                                    {/* Spacer before summary */}
                                    {teamRanks.length > 0 && displayMembers.length === 0 && (
                                        <tr>
                                            <td colSpan={35} style={{ height: 12, background: 'transparent', border: 'none' }} />
                                        </tr>
                                    )}

                                    {/* Top 10 counts row */}
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
                    </div>
                </>
            )}

            {activeTab === 'domains' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, padding: '0 24px' }}>
                    <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600 }}>
                                {tt('domains')} ({showTop10Domains ? tt('top10') : tt('top5')})
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
                        {sourceMembers.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <RePieChart>
                                    <Pie data={domainData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                        outerRadius={100} innerRadius={50} paddingAngle={3} strokeWidth={0}>
                                        {domainData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                    <Legend iconType="circle" />
                                </RePieChart>
                            </ResponsiveContainer>
                        ) : <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No data</p>}
                    </div>

                    <div className="glass-card" style={{ padding: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Team Domain Radar</h3>
                        {sourceMembers.length > 0 ? (
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
            )
            }

            {
                activeTab === 'profiles' && (
                    <div style={{ padding: '0 24px' }}>
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
                            {displayMembers.map(member => {
                                const topN = member.results.filter(r => r.rank <= (showTop10Profiles ? 10 : 5));
                                const domainProfile: Record<GallupDomain, number> = {
                                    executing: 0, influencing: 0, relationship_building: 0, strategic_thinking: 0,
                                };
                                topN.forEach(r => {
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
        </div>
    );
}
