import type {
  AssistantStructuredContent,
  AssistantConfidenceLevel,
  AssistantRelatedEntity,
} from './types';
import {
  HIGH_RISK_TOPICS,
  SAFETY_NOTICE,
  NO_DATA_RESPONSE_EN,
  NO_DATA_RESPONSE_FR,
  INJECTION_PATTERNS,
} from './types';
import type { RetrievalContext } from './retrieval';

// ============================================================
// PHASE 5.4 — RESPONSE BUILDER (Mode A: retrieval_only)
// Builds structured answers from verified Seafood Vision data
// Never invents facts, certifications, prices, or sources
// ============================================================

export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

export function detectLanguage(text: string): string {
  const frWords = /\b(quels?|quelle|est|sont|les|des|une|pour|dans|avec|montrez|trouvez|cherche|différence|emballages?|présentations?|noms?|données?)\b/i;
  const esWords = /\b(qué|cuál|cuáles|son|los|las|una|para|con|mostrar|buscar|diferencia|embalajes?|presentaciones?|nombres?)\b/i;
  const ptWords = /\b(qual|quais|são|os|as|uma|para|com|mostrar|buscar|diferença|embalagens?|apresentações?|nomes?)\b/i;
  if (frWords.test(text)) return 'fr';
  if (esWords.test(text)) return 'es';
  if (ptWords.test(text)) return 'pt';
  return 'en';
}

export function isHighRiskTopic(query: string): boolean {
  const q = query.toLowerCase();
  return HIGH_RISK_TOPICS.some((t) => q.includes(t));
}

export function isMediaQuery(query: string): boolean {
  const q = query.toLowerCase();
  return /\b(photo|image|picture|media|thumbnail|visual|show|find|display)\b/.test(q) ||
    /\b(photo|image|miniature|visuel|montrez|trouvez|afficher)\b/.test(q);
}

export function isComparisonQuery(query: string): boolean {
  return /\bvs\.?\b|\bversus\b|\bcompare\b|\bcomparison\b|\bdifference\b|\bdifférence\b|\bcomparer\b/i.test(query);
}

export function calculateConfidence(ctx: RetrievalContext): AssistantConfidenceLevel {
  const { entities, sources, facts } = ctx;
  if (entities.length === 0 && sources.length === 0) return 'none';
  const verifiedCount = entities.filter(
    (e) => e.status === 'verified' || e.status === 'approved' || e.status === 'commercial'
  ).length;
  const score = (verifiedCount / Math.max(entities.length, 1)) * 0.6 +
    Math.min(sources.length / 5, 1) * 0.2 +
    Math.min(facts.length / 5, 1) * 0.2;
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'moderate';
  return 'limited';
}

export function buildSuggestedQuestions(
  ctx: RetrievalContext,
  locale: string
): string[] {
  const suggestions: string[] = [];
  const topEntity = ctx.entities[0];
  if (!topEntity) return getDefaultSuggestions(locale);

  if (topEntity.type === 'species') {
    const name = topEntity.title;
    if (locale === 'fr') {
      suggestions.push(
        `Quelles présentations de ${name} sont vérifiées ?`,
        `Quels emballages sont associés à ${name} ?`,
        `Quels médias montrent ${name} ?`,
        `Quelles certifications sont référencées pour ${name} ?`
      );
    } else {
      suggestions.push(
        `Show frozen ${name} product forms`,
        `What packaging is associated with ${name}?`,
        `Find photos of ${name}`,
        `What certifications are referenced for ${name}?`
      );
    }
  } else if (topEntity.type === 'product') {
    if (locale === 'fr') {
      suggestions.push(
        `Quels marchés sont liés à ce produit ?`,
        `Quels emballages sont disponibles ?`,
        `Quelles certifications sont vérifiées ?`
      );
    } else {
      suggestions.push(
        `What markets are linked to this product?`,
        `What packaging options are available?`,
        `What certifications are verified?`
      );
    }
  }

  return suggestions.slice(0, 4);
}

function getDefaultSuggestions(locale: string): string[] {
  if (locale === 'fr') {
    return [
      "Qu'est-ce que l'Octopus vulgaris ?",
      'Montrez des produits de sardine congelée',
      'Comparez IQF et block frozen',
      'Trouvez des photos de maquereau',
    ];
  }
  return [
    'What is Octopus vulgaris?',
    'Show frozen sardine products',
    'Compare IQF and block frozen',
    'Find tuna public documents',
  ];
}

export function buildAnswer(ctx: RetrievalContext, locale: string): string {
  const { entities, facts, query } = ctx;

  if (entities.length === 0) {
    return locale === 'fr' ? NO_DATA_RESPONSE_FR : NO_DATA_RESPONSE_EN;
  }

  const lines: string[] = [];
  const topEntity = entities[0];

  if (topEntity.type === 'species') {
    lines.push(locale === 'fr'
      ? `**${topEntity.title}** (*${topEntity.subtitle || ''}*) est une espèce référencée dans Seafood Vision.`
      : `**${topEntity.title}** (*${topEntity.subtitle || ''}*) is a species referenced in Seafood Vision.`
    );
  } else if (topEntity.type === 'product') {
    lines.push(locale === 'fr'
      ? `**${topEntity.title}** est un produit commercial référencé dans Seafood Vision.`
      : `**${topEntity.title}** is a commercial product referenced in Seafood Vision.`
    );
  } else if (topEntity.type === 'certification') {
    lines.push(locale === 'fr'
      ? `**${topEntity.title}** est une certification référencée dans Seafood Vision.`
      : `**${topEntity.title}** is a certification referenced in Seafood Vision.`
    );
  } else if (topEntity.type === 'market') {
    lines.push(locale === 'fr'
      ? `**${topEntity.title}** est un marché référencé dans Seafood Vision.`
      : `**${topEntity.title}** is a market referenced in Seafood Vision.`
    );
  } else {
    lines.push(locale === 'fr'
      ? `Seafood Vision contient des informations sur : **${topEntity.title}**.`
      : `Seafood Vision contains information about: **${topEntity.title}**.`
    );
  }

  if (facts.length > 0) {
    lines.push('');
    facts.slice(0, 6).forEach((f) => lines.push(`• ${f}`));
  }

  if (entities.length > 1) {
    lines.push('');
    lines.push(locale === 'fr'
      ? `**Entités associées trouvées :** ${entities.slice(1, 5).map(e => e.title).join(', ')}`
      : `**Related entities found:** ${entities.slice(1, 5).map(e => e.title).join(', ')}`
    );
  }

  return lines.join('\n');
}

export function buildStructuredResponse(
  ctx: RetrievalContext,
  locale: string
): AssistantStructuredContent {
  const confidence = calculateConfidence(ctx);
  const answer = buildAnswer(ctx, locale);
  const isHighRisk = isHighRiskTopic(ctx.query);

  const limitations: string[] = [];
  if (ctx.entities.length === 0) {
    limitations.push(locale === 'fr' ?'Aucune donnée vérifiée trouvée pour cette question.' :'No verified data found for this question.'
    );
  }
  if (confidence === 'limited') {
    limitations.push(locale === 'fr' ?'Les informations disponibles sont limitées. Vérifiez auprès des sources officielles.' :'Available information is limited. Please verify with official sources.'
    );
  }

  const verifiedFacts = ctx.facts.slice(0, 8);

  let answer_type: AssistantStructuredContent['answer_type'] = 'general';
  if (ctx.entities.length === 0) answer_type = 'no_data';
  else if (ctx.detected_types.includes('species')) answer_type = 'species';
  else if (ctx.detected_types.includes('product')) answer_type = 'product';
  else if (ctx.detected_types.includes('packaging')) answer_type = 'packaging';
  else if (ctx.detected_types.includes('market')) answer_type = 'market';
  else if (ctx.detected_types.includes('certification')) answer_type = 'certification';
  else if (ctx.detected_types.includes('document')) answer_type = 'document';
  else if (ctx.detected_types.includes('media')) answer_type = 'media';

  return {
    answer,
    answer_type,
    confidence_level: confidence,
    verified_facts: verifiedFacts,
    limitations,
    sources: ctx.sources.slice(0, 8),
    related_entities: ctx.entities.slice(0, 8),
    related_media: ctx.media.slice(0, 6),
    suggested_questions: buildSuggestedQuestions(ctx, locale),
    safety_notice: isHighRisk ? SAFETY_NOTICE : undefined,
    provider_mode: 'retrieval_only',
  };
}

export function buildInjectionRefusal(locale: string): AssistantStructuredContent {
  return {
    answer: locale === 'fr' ?'Cette demande ne peut pas être traitée. Seafood Vision répond uniquement aux questions sur les espèces, produits et données seafood vérifiées.' :'This request cannot be processed. Seafood Vision only answers questions about verified seafood species, products, and data.',
    answer_type: 'no_data',
    confidence_level: 'none',
    verified_facts: [],
    limitations: [locale === 'fr' ?'Demande non autorisée.' :'Request not authorized.'
    ],
    sources: [],
    related_entities: [],
    related_media: [],
    suggested_questions: getDefaultSuggestions(locale),
    provider_mode: 'retrieval_only',
  };
}

export function buildComparisonResponse(
  terms: string[],
  entityGroups: AssistantRelatedEntity[][],
  locale: string
): AssistantStructuredContent {
  const allEntities = entityGroups.flat();
  const commonTypes = entityGroups[0]?.map(e => e.type).filter(t =>
    entityGroups.every(g => g.some(e => e.type === t))
  ) || [];

  const answer = locale === 'fr'
    ? `Comparaison entre : ${terms.join(' et ')}. Seafood Vision contient des données vérifiées pour ces entités.`
    : `Comparison between: ${terms.join(' and ')}. Seafood Vision contains verified data for these entities.`;

  return {
    answer,
    answer_type: 'comparison',
    confidence_level: allEntities.length > 0 ? 'moderate' : 'none',
    verified_facts: [],
    limitations: [locale === 'fr' ?'La comparaison est basée uniquement sur les données vérifiées disponibles dans Seafood Vision.' :'Comparison is based only on verified data available in Seafood Vision.'
    ],
    sources: [],
    related_entities: allEntities.slice(0, 9),
    related_media: [],
    suggested_questions: getDefaultSuggestions(locale),
    provider_mode: 'retrieval_only',
    comparison: {
      entities: allEntities.slice(0, 3),
      common_points: commonTypes.map(t => locale === 'fr' ? `Type commun: ${t}` : `Common type: ${t}`),
      differences: terms.map((term, i) => ({
        aspect: term,
        values: Object.fromEntries(
          (entityGroups[i] || []).slice(0, 2).map(e => [e.type, e.title])
        ),
      })),
      unverified_notes: [locale === 'fr' ?'Certaines différences peuvent ne pas être disponibles dans la base actuelle.' :'Some differences may not be available in the current database.'
      ],
    },
  };
}
