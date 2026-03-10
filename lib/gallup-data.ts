/**
 * Complete list of 34 CliftonStrengths talents organized by domain.
 * Used for seeding, display, and analysis throughout the application.
 */

export type GallupDomain = 'executing' | 'influencing' | 'relationship_building' | 'strategic_thinking';

export interface GallupTalent {
    code: string;
    en: string;
    pl: string;
    domain: GallupDomain;
}

export const DOMAIN_COLORS: Record<GallupDomain, string> = {
    executing: '#6B33CC',
    influencing: '#F97415',
    relationship_building: '#1A80E6',
    strategic_thinking: '#1FAD91',
};

/**
 * CSS Variable names for domains (matching globals.css)
 */
export const DOMAIN_VAR_MAP: Record<GallupDomain, string> = {
    executing: 'var(--domain-executing)',
    influencing: 'var(--domain-influencing)',
    relationship_building: 'var(--domain-relationship)',
    strategic_thinking: 'var(--domain-strategic)',
};

/**
 * Helper to get domain color as CSS variable or color-mix for transparency
 */
export function getDomainStyle(domain: GallupDomain, opacity: number = 100): string {
    const varName = DOMAIN_VAR_MAP[domain];
    if (opacity === 100) return varName;
    return `color-mix(in srgb, ${varName} ${opacity}%, transparent)`;
}

export const DOMAIN_LABELS: Record<GallupDomain, { en: string; pl: string }> = {
    executing: { en: 'Executing', pl: 'Realizowanie' },
    influencing: { en: 'Influencing', pl: 'Wywieranie wpływu' },
    relationship_building: { en: 'Relationship Building', pl: 'Budowanie relacji' },
    strategic_thinking: { en: 'Strategic Thinking', pl: 'Myślenie strategiczne' },
};

export const GALLUP_TALENTS: GallupTalent[] = [
    // Executing
    { code: 'achiever', en: 'Achiever', pl: 'Osiąganie', domain: 'executing' },
    { code: 'arranger', en: 'Arranger', pl: 'Organizowanie', domain: 'executing' },
    { code: 'belief', en: 'Belief', pl: 'Pryncypialność', domain: 'executing' },
    { code: 'consistency', en: 'Consistency', pl: 'Bezstronność', domain: 'executing' },
    { code: 'deliberative', en: 'Deliberative', pl: 'Rozwaga', domain: 'executing' },
    { code: 'discipline', en: 'Discipline', pl: 'Dyscyplina', domain: 'executing' },
    { code: 'focus', en: 'Focus', pl: 'Ukierunkowanie', domain: 'executing' },
    { code: 'responsibility', en: 'Responsibility', pl: 'Odpowiedzialność', domain: 'executing' },
    { code: 'restorative', en: 'Restorative', pl: 'Naprawianie', domain: 'executing' },

    // Influencing
    { code: 'activator', en: 'Activator', pl: 'Aktywator', domain: 'influencing' },
    { code: 'command', en: 'Command', pl: 'Dowodzenie', domain: 'influencing' },
    { code: 'communication', en: 'Communication', pl: 'Komunikatywność', domain: 'influencing' },
    { code: 'competition', en: 'Competition', pl: 'Rywalizacja', domain: 'influencing' },
    { code: 'maximizer', en: 'Maximizer', pl: 'Maksymalista', domain: 'influencing' },
    { code: 'self-assurance', en: 'Self-Assurance', pl: 'Wiara w siebie', domain: 'influencing' },
    { code: 'significance', en: 'Significance', pl: 'Poważanie', domain: 'influencing' },
    { code: 'woo', en: 'Woo', pl: 'Czar', domain: 'influencing' },

    // Relationship Building
    { code: 'adaptability', en: 'Adaptability', pl: 'Elastyczność', domain: 'relationship_building' },
    { code: 'connectedness', en: 'Connectedness', pl: 'Współzależność', domain: 'relationship_building' },
    { code: 'developer', en: 'Developer', pl: 'Rozwijanie innych', domain: 'relationship_building' },
    { code: 'empathy', en: 'Empathy', pl: 'Empatia', domain: 'relationship_building' },
    { code: 'harmony', en: 'Harmony', pl: 'Zgodność', domain: 'relationship_building' },
    { code: 'includer', en: 'Includer', pl: 'Integrator', domain: 'relationship_building' },
    { code: 'individualization', en: 'Individualization', pl: 'Indywidualizacja', domain: 'relationship_building' },
    { code: 'positivity', en: 'Positivity', pl: 'Optymista', domain: 'relationship_building' },
    { code: 'relator', en: 'Relator', pl: 'Bliskość', domain: 'relationship_building' },

    // Strategic Thinking
    { code: 'analytical', en: 'Analytical', pl: 'Analityk', domain: 'strategic_thinking' },
    { code: 'context', en: 'Context', pl: 'Kontekst', domain: 'strategic_thinking' },
    { code: 'futuristic', en: 'Futuristic', pl: 'Wizjoner', domain: 'strategic_thinking' },
    { code: 'ideation', en: 'Ideation', pl: 'Odkrywczość', domain: 'strategic_thinking' },
    { code: 'input', en: 'Input', pl: 'Zbieranie', domain: 'strategic_thinking' },
    { code: 'intellection', en: 'Intellection', pl: 'Intelekt', domain: 'strategic_thinking' },
    { code: 'learner', en: 'Learner', pl: 'Uczenie się', domain: 'strategic_thinking' },
    { code: 'strategic', en: 'Strategic', pl: 'Strateg', domain: 'strategic_thinking' },
];

/**
 * Get talent by code
 */
export function getTalentByCode(code: string): GallupTalent | undefined {
    return GALLUP_TALENTS.find(t => t.code === code);
}

/**
 * Get all talents for a specific domain
 */
export function getTalentsByDomain(domain: GallupDomain): GallupTalent[] {
    return GALLUP_TALENTS.filter(t => t.domain === domain);
}
