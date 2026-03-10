'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { GALLUP_TALENTS, getDomainStyle, DOMAIN_LABELS, type GallupDomain, getTalentsByDomain } from '@/lib/gallup-data';
import { teamTalentRanks } from '@/lib/team-algorithms';
import { Info } from 'lucide-react';

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

    // Team talent rankings
    const talentCodes = GALLUP_TALENTS.map(t => t.code);
    const membersRankMaps = allMembersWithResults.map(m => {
        const map: Record<string, number> = {};
        m.results.forEach(r => { map[r.talent] = r.rank; });
        return map;
    });
    const teamRanks = teamTalentRanks(membersRankMaps, talentCodes);
    const teamRankMap: Record<string, number> = {};
    teamRanks.forEach(tr => { teamRankMap[tr.talent] = tr.teamRank; });

    // Top 10 counts
    const talentTop10Counts: Record<string, number> = {};
    allMembersWithResults.forEach(m => {
        m.results.filter(r => r.rank <= 10).forEach(r => {
            talentTop10Counts[r.talent] = (talentTop10Counts[r.talent] || 0) + 1;
        });
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
                            {teamRanks.length > 0 && displayMembers.length > 0 && (
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
        </div>
    );
}
