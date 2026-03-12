/**
 * Team talent ranking algorithms.
 *
 * 1. dominantDomain  – person's dominant domain from Top 5 talents
 * 2. teamTalentRanks – team-level talent rankings via geometric mean
 * 3. talentBuckets   – bucket stats for a set of ranks
 */

import type { GallupDomain } from './gallup-data';

// Deterministic tie-break order
const DOMAIN_ORDER: GallupDomain[] = [
    'executing',
    'influencing',
    'relationship_building',
    'strategic_thinking',
];

// ─── Types ──────────────────────────────────────────────────────────────

export interface PersonTalent {
    talent: string;
    rank: number;
    domain: string;
}

export interface DominantDomainResult {
    dominantDomain: GallupDomain;
    top5Counts: Record<GallupDomain, number>;
    top5RanksByDomain: Record<GallupDomain, number[]>;
}

export interface BucketStats {
    top_5: number;
    top_10: number;
    mid: number;
    bottom_5: number;
}

export interface TeamTalentRankResult {
    talent: string;
    geometricMean: number;
    teamRank: number;
    avgRank: number;
    buckets: BucketStats;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function geometricMean(values: number[]): number {
    if (values.length === 0) return 0;
    const logSum = values.reduce((sum, v) => sum + Math.log(v), 0);
    return Math.exp(logSum / values.length);
}

/**
 * Compare two sorted rank arrays lexicographically.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareSortedRanks(a: number[], b: number[]): number {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const ra = i < a.length ? a[i] : Infinity;
        const rb = i < b.length ? b[i] : Infinity;
        if (ra !== rb) return ra - rb;
    }
    return 0;
}

// ─── 1. Dominant Domain ─────────────────────────────────────────────────

/**
 * Determine a person's dominant domain based on their Top 5 talents.
 *
 * Tie-break rules:
 *  1. Most talents in Top 5
 *  2. Best (lowest) ranks lexicographically
 *  3. Fallback to DOMAIN_ORDER
 */
export function dominantDomain(personTalents: PersonTalent[]): DominantDomainResult {
    const top5 = personTalents.filter(t => t.rank <= 5);

    const grouped: Record<GallupDomain, number[]> = {
        executing: [],
        influencing: [],
        relationship_building: [],
        strategic_thinking: [],
    };

    for (const t of top5) {
        const d = t.domain as GallupDomain;
        if (grouped[d]) {
            grouped[d].push(t.rank);
        }
    }

    // Sort ranks ascending within each domain
    for (const d of DOMAIN_ORDER) {
        grouped[d].sort((a, b) => a - b);
    }

    const top5Counts = {} as Record<GallupDomain, number>;
    const top5RanksByDomain = {} as Record<GallupDomain, number[]>;
    for (const d of DOMAIN_ORDER) {
        top5Counts[d] = grouped[d].length;
        top5RanksByDomain[d] = [...grouped[d]];
    }

    // Pick best domain using composite key:
    //   (-count, ranks_ascending, domain_order_index)
    let bestDomain: GallupDomain = DOMAIN_ORDER[0];
    let bestCount = -1;
    let bestRanks: number[] = [];
    let bestIdx = 0;

    for (let i = 0; i < DOMAIN_ORDER.length; i++) {
        const d = DOMAIN_ORDER[i];
        const count = grouped[d].length;
        const ranks = grouped[d];

        if (
            count > bestCount ||
            (count === bestCount && compareSortedRanks(ranks, bestRanks) < 0) ||
            (count === bestCount && compareSortedRanks(ranks, bestRanks) === 0 && i < bestIdx)
        ) {
            bestDomain = d;
            bestCount = count;
            bestRanks = ranks;
            bestIdx = i;
        }
    }

    return { dominantDomain: bestDomain, top5Counts, top5RanksByDomain };
}

// ─── 2. Talent Buckets ──────────────────────────────────────────────────

/**
 * Categorise an array of ranks into buckets.
 */
export function talentBuckets(ranks: number[]): BucketStats {
    const result: BucketStats = { top_5: 0, top_10: 0, mid: 0, bottom_5: 0 };

    for (const r of ranks) {
        if (r >= 1 && r <= 5) result.top_5++;
        else if (r >= 6 && r <= 10) result.top_10++;
        else if (r >= 11 && r <= 29) result.mid++;
        else if (r >= 30 && r <= 34) result.bottom_5++;
    }

    return result;
}

// ─── 3. Team Talent Ranks ───────────────────────────────────────────────

interface MemberRankMap {
    [talentCode: string]: number;
}

/**
 * Calculate team-level talent rankings using geometric mean.
 *
 * @param membersRankMaps  Array of { talentCode → rank } maps, one per member
 * @param talentCodes      Ordered list of all 34 talent codes
 * @returns Sorted array of team talent rank results (teamRank 1 = strongest)
 */
export function teamTalentRanks(
    membersRankMaps: MemberRankMap[],
    talentCodes: string[],
): TeamTalentRankResult[] {
    if (membersRankMaps.length === 0) return [];

    const scores: {
        talent: string;
        gm: number;
        avgRank: number;
        buckets: BucketStats;
    }[] = [];

    for (const talent of talentCodes) {
        const ranks: number[] = [];
        for (const memberMap of membersRankMaps) {
            const r = memberMap[talent];
            if (r !== undefined && r >= 1) {
                ranks.push(r);
            }
        }

        if (ranks.length === 0) continue;

        const gm = geometricMean(ranks);
        const avgRank = ranks.reduce((s, r) => s + r, 0) / ranks.length;
        const buckets = talentBuckets(ranks);

        scores.push({ talent, gm, avgRank, buckets });
    }

    // Sort ascending by geometric mean (lower = stronger)
    scores.sort((a, b) => a.gm - b.gm);

    // Assign team ranks 1..N
    return scores.map((item, idx) => ({
        talent: item.talent,
        geometricMean: Math.round(item.gm * 100) / 100,
        teamRank: idx + 1,
        avgRank: Math.round(item.avgRank * 100) / 100,
        buckets: item.buckets,
    }));
}

// ─── 4. Weighted Talent Score ───────────────────────────────────────────

/**
 * Convert a Gallup rank (1-34) to a weighted point score.
 * Top 5 are heavily weighted, Bottom 5 incur penalties.
 */
export function talentScore(rank: number): number {
    if (rank <= 5) return 10 - (rank - 1);           // 10, 9, 8, 7, 6
    if (rank <= 10) return 5 - (rank - 6) * 0.8;     // 5.0, 4.2, 3.4, 2.6, 1.8
    if (rank <= 29) return 0;                          // neutral
    return -(rank - 29);                               // -1, -2, -3, -4, -5
}

// ─── 5. Team Domain Scores (weighted) ───────────────────────────────────

export interface DomainScoreResult {
    domain: GallupDomain;
    score: number;
    maxPossible: number;
    percentage: number;     // score as % of max possible
}

/**
 * Calculate team domain strength using the weighted point system.
 * Each member's talent ranks are converted to points, then summed per domain.
 * This creates clear differentiation even for large teams.
 */
export function teamDomainScores(
    membersRankMaps: MemberRankMap[],
    talentsByDomain: Record<GallupDomain, string[]>,
): DomainScoreResult[] {
    if (membersRankMaps.length === 0) return [];

    const domains = DOMAIN_ORDER;

    const results = domains.map(domain => {
        const talentCodes = talentsByDomain[domain];
        let totalScore = 0;

        for (const memberMap of membersRankMaps) {
            for (const talent of talentCodes) {
                const rank = memberMap[talent];
                if (rank !== undefined) {
                    totalScore += talentScore(rank);
                }
            }
        }

        // Max possible: every member has every domain talent in positions 1-N
        const maxPossible = membersRankMaps.length * talentCodes.reduce((sum, _, i) =>
            sum + talentScore(Math.min(i + 1, 5)), 0);

        return {
            domain,
            score: Math.round(totalScore * 10) / 10,
            maxPossible: Math.round(maxPossible * 10) / 10,
            percentage: maxPossible > 0
                ? Math.round((totalScore / maxPossible) * 100)
                : 0,
        };
    });

    return results;
}

// ─── 6. Team Weaknesses (merged Blind Spots + Basement) ─────────────────

export interface TeamWeaknessResult {
    talentCode: string;
    bottomCount: number;     // how many members have rank 30-34
    totalMembers: number;
    percentage: number;      // % of team with this in bottom 5
}

/**
 * Find team weaknesses: talents that appear in the Bottom 5 (rank 30-34)
 * for a significant portion of the team.
 *
 * @param threshold Minimum fraction of team (0-1) that must have in bottom 5
 */
export function findTeamWeaknesses(
    membersRankMaps: MemberRankMap[],
    talentCodes: string[],
    threshold: number = 0.3,
): TeamWeaknessResult[] {
    const totalMembers = membersRankMaps.length;
    if (totalMembers === 0) return [];

    return talentCodes
        .map(talent => {
            const bottomCount = membersRankMaps.filter(m => {
                const rank = m[talent];
                return rank !== undefined && rank >= 30;
            }).length;
            return {
                talentCode: talent,
                bottomCount,
                totalMembers,
                percentage: Math.round((bottomCount / totalMembers) * 100),
            };
        })
        .filter(r => r.bottomCount / totalMembers >= threshold)
        .sort((a, b) => b.percentage - a.percentage);
}

// ─── 7. Single Point of Failure (SPOF) ─────────────────────────────────

export interface SPOFResult {
    talentCode: string;
    memberIndex: number;     // index in membersRankMaps of the sole carrier
    memberRank: number;      // their rank for this talent
}

/**
 * Detect talents that only ONE person in the team has in their Top 10.
 * These are critical dependencies — if that person leaves, the capability is lost.
 */
export function findSPOF(
    membersRankMaps: MemberRankMap[],
    talentCodes: string[],
): SPOFResult[] {
    return talentCodes
        .map(talent => {
            const carriers: { index: number; rank: number }[] = [];
            membersRankMaps.forEach((m, i) => {
                const rank = m[talent];
                if (rank !== undefined && rank <= 10) {
                    carriers.push({ index: i, rank });
                }
            });
            if (carriers.length === 1) {
                return {
                    talentCode: talent,
                    memberIndex: carriers[0].index,
                    memberRank: carriers[0].rank,
                };
            }
            return null;
        })
        .filter((r): r is SPOFResult => r !== null)
        .sort((a, b) => a.memberRank - b.memberRank);
}

// ─── 8. Domain Specialist ───────────────────────────────────────────────

export interface DomainSpecialistResult {
    isSpecialist: boolean;
    specialistDomain: GallupDomain | null;
    count: number;           // how many of top 5 are in the specialist domain
}

/**
 * Check if a member is a "Domain Specialist" — has 4 or more of their
 * Top 5 talents in a single domain.
 */
export function checkDomainSpecialist(
    memberRankMap: MemberRankMap,
    talentCodes: string[],
    talentDomainMap: Record<string, GallupDomain>,
): DomainSpecialistResult {
    // Get top 5 talents by rank
    const top5 = talentCodes
        .filter(t => memberRankMap[t] !== undefined)
        .sort((a, b) => memberRankMap[a] - memberRankMap[b])
        .slice(0, 5);

    const domainCounts: Record<GallupDomain, number> = {
        executing: 0, influencing: 0,
        relationship_building: 0, strategic_thinking: 0,
    };

    top5.forEach(talent => {
        const domain = talentDomainMap[talent];
        if (domain) domainCounts[domain]++;
    });

    const entries = Object.entries(domainCounts)
        .sort((a, b) => b[1] - a[1]);
    const [bestDomain, bestCount] = entries[0];

    return {
        isSpecialist: bestCount >= 4,
        specialistDomain: bestCount >= 4 ? bestDomain as GallupDomain : null,
        count: bestCount,
    };
}
