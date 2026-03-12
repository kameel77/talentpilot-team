'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { GALLUP_TALENTS, getDomainStyle, DOMAIN_LABELS, type GallupDomain, getTalentsByDomain } from '@/lib/gallup-data';
import { teamTalentRanks, teamDomainScores, findTeamWeaknesses, findSPOF, checkDomainSpecialist } from '@/lib/team-algorithms';
import { Info, BarChart3, Grid3x3, PieChart as PieChartIcon, AlertTriangle, Star, TrendingDown, ShieldAlert } from 'lucide-react';
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
    const [showTop10, setShowTop10] = useState(true);

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
    const teamTopN = teamRanks.filter(tr => tr.teamRank <= (showTop10 ? 10 : 5));
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

    // P1: Team weaknesses (merged blind spots + basement)
    const teamWeaknesses = membersRankMaps.length > 0
        ? findTeamWeaknesses(membersRankMaps, talentCodes)
        : [];

    // P1: SPOF detection
    const spofList = membersRankMaps.length > 0
        ? findSPOF(membersRankMaps, talentCodes)
        : [];

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
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, padding: '0 24px', alignItems: 'center' }}>
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

                {/* Global Top 5/10 Toggle (visible for Domains and Profiles) */}
                {(activeTab === 'domains' || activeTab === 'profiles') && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: 'var(--bg-card)', padding: 4, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                        <button
                            className={`btn ${!showTop10 ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ padding: '4px 12px', fontSize: 13, minHeight: 0, height: 32 }}
                            onClick={() => setShowTop10(false)}
                        >
                            Top 5
                        </button>
                        <button
                            className={`btn ${showTop10 ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ padding: '4px 12px', fontSize: 13, minHeight: 0, height: 32 }}
                            onClick={() => setShowTop10(true)}
                        >
                            Top 10
                        </button>
                    </div>
                )}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '0 24px' }}>
                    {/* Top row: Pie - Rank Tags - Radar */}
                    <div style={{ display: 'grid', gridTemplateColumns: '4fr 2fr 4fr', gap: 20 }}>
                        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                                {tt('domainCount')} {showTop10 ? tt('top10') : tt('top5')}
                            </h3>
                            {sourceMembers.length > 0 ? (
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
                                    const carrier = sourceMembers[spof.memberIndex];
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

            {
                activeTab === 'profiles' && (
                    <div style={{ padding: '0 24px' }}>
                        <div className="cards-grid">
                            {displayMembers.map(member => {
                                const topN = member.results.filter(r => r.rank <= (showTop10 ? 10 : 5));
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
                                                {showTop10 ? tt('top10') : tt('top5')}
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
