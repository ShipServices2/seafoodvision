// ============================================================
// SEAFOOD VISION — AI Provider Abstraction Layer (Phase 8)
// Pluggable: OpenAI, Gemini, Anthropic, Local, Mock
// Never locked to a single model
// ============================================================

export type AIProviderType = 'openai' | 'gemini' | 'anthropic' | 'local' | 'mock';

export interface AISpeciesCandidate {
  rank: number;
  commonName: string;
  scientificName: string;
  family: string;
  genus: string;
  confidence: number;       // 0-100
  similarity: number;       // 0-100
  mainReasons: string[];
  productForm?: string;
  sourceProvider: AIProviderType;
}

export interface AIIdentificationResult {
  jobId: string;
  candidates: AISpeciesCandidate[];  // Always Top 5, never single
  visualFeatures: Record<string, unknown>;
  processingTimeMs: number;
  provider: AIProviderType;
  model: string;
  ambiguityDetected: boolean;
  notes?: string;
}

export interface AIIdentificationRequest {
  jobId: string;
  assetId?: string;
  imageUrl?: string;
  imageBase64?: string;
  contextHints: {
    currentName?: string;
    currentCategory?: string;
    originalFilename?: string;
    importBatch?: string;
    folderPath?: string;
    tags?: string[];
    existingMetadata?: Record<string, unknown>;
  };
}

// ============================================================
// Abstract Provider Interface
// ============================================================

export interface IAIProvider {
  readonly name: AIProviderType;
  readonly model: string;
  readonly isAvailable: boolean;
  identify(request: AIIdentificationRequest): Promise<AIIdentificationResult>;
}

// ============================================================
// Mock Provider — Development / Testing
// Returns structured Top 5 suggestions without any real AI call
// ============================================================

export class MockAIProvider implements IAIProvider {
  readonly name: AIProviderType = 'mock';
  readonly model = 'seafood-vision-mock-v1';
  readonly isAvailable = true;

  async identify(request: AIIdentificationRequest): Promise<AIIdentificationResult> {
    const start = Date.now();

    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 300));

    const mockCandidates: AISpeciesCandidate[] = [
      {
        rank: 1,
        commonName: 'Atlantic Salmon',
        scientificName: 'Salmo salar',
        family: 'Salmonidae',
        genus: 'Salmo',
        confidence: 72,
        similarity: 68,
        mainReasons: ['Coloration pattern matches', 'Body shape consistent with Salmonidae', 'File context suggests salmon'],
        productForm: 'Fillet',
        sourceProvider: 'mock',
      },
      {
        rank: 2,
        commonName: 'Rainbow Trout',
        scientificName: 'Oncorhynchus mykiss',
        family: 'Salmonidae',
        genus: 'Oncorhynchus',
        confidence: 58,
        similarity: 55,
        mainReasons: ['Similar family to rank 1', 'Lateral line pattern visible', 'Ambiguity with Salmo salar'],
        productForm: 'Fillet',
        sourceProvider: 'mock',
      },
      {
        rank: 3,
        commonName: 'Brown Trout',
        scientificName: 'Salmo trutta',
        family: 'Salmonidae',
        genus: 'Salmo',
        confidence: 41,
        similarity: 38,
        mainReasons: ['Same genus as rank 1', 'Spot pattern partially matches', 'Lower confidence due to processing state'],
        productForm: 'Whole',
        sourceProvider: 'mock',
      },
      {
        rank: 4,
        commonName: 'Arctic Char',
        scientificName: 'Salvelinus alpinus',
        family: 'Salmonidae',
        genus: 'Salvelinus',
        confidence: 28,
        similarity: 25,
        mainReasons: ['Salmonidae family match', 'Color range overlaps', 'Insufficient detail for higher rank'],
        productForm: 'Fillet',
        sourceProvider: 'mock',
      },
      {
        rank: 5,
        commonName: 'Coho Salmon',
        scientificName: 'Oncorhynchus kisutch',
        family: 'Salmonidae',
        genus: 'Oncorhynchus',
        confidence: 18,
        similarity: 15,
        mainReasons: ['Pacific salmon possibility', 'Low confidence — ambiguity detected', 'Requires human review'],
        productForm: 'Steak',
        sourceProvider: 'mock',
      },
    ];

    // Adjust based on context hints
    if (request.contextHints.currentName) {
      mockCandidates[0].mainReasons.push(`Current name hint: "${request.contextHints.currentName}"`);
    }
    if (request.contextHints.importBatch) {
      mockCandidates[0].mainReasons.push(`Import batch context: ${request.contextHints.importBatch}`);
    }

    return {
      jobId: request.jobId,
      candidates: mockCandidates,
      visualFeatures: {
        silhouette: 'elongated',
        coloration: 'silver-pink',
        fins: 'adipose_fin_present',
        productForm: 'fillet',
        texture: 'smooth',
      },
      processingTimeMs: Date.now() - start,
      provider: 'mock',
      model: this.model,
      ambiguityDetected: true, // Always true in mock — never single answer
      notes: 'Mock provider — Top 5 suggestions for human review. No automatic identification.',
    };
  }
}

// ============================================================
// OpenAI Provider — Placeholder (requires OPENAI_API_KEY)
// ============================================================

export class OpenAIProvider implements IAIProvider {
  readonly name: AIProviderType = 'openai';
  readonly model = 'gpt-4o';
  readonly isAvailable: boolean;

  constructor() {
    this.isAvailable = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here');
  }

  async identify(request: AIIdentificationRequest): Promise<AIIdentificationResult> {
    if (!this.isAvailable) {
      throw new Error('OpenAI provider not configured. Set OPENAI_API_KEY environment variable.');
    }
    // Full implementation available when API key is configured
    // Returns Top 5 species candidates with confidence scores
    // Visual analysis: silhouette, coloration, fins, texture, product form
    throw new Error('OpenAI provider: implementation pending API key configuration.');
  }
}

// ============================================================
// Gemini Provider — Placeholder (requires GEMINI_API_KEY)
// ============================================================

export class GeminiProvider implements IAIProvider {
  readonly name: AIProviderType = 'gemini';
  readonly model = 'gemini-1.5-pro';
  readonly isAvailable: boolean;

  constructor() {
    this.isAvailable = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key-here');
  }

  async identify(request: AIIdentificationRequest): Promise<AIIdentificationResult> {
    if (!this.isAvailable) {
      throw new Error('Gemini provider not configured. Set GEMINI_API_KEY environment variable.');
    }
    throw new Error('Gemini provider: implementation pending API key configuration.');
  }
}

// ============================================================
// Anthropic Provider — Placeholder (requires ANTHROPIC_API_KEY)
// ============================================================

export class AnthropicProvider implements IAIProvider {
  readonly name: AIProviderType = 'anthropic';
  readonly model = 'claude-3-5-sonnet-20241022';
  readonly isAvailable: boolean;

  constructor() {
    this.isAvailable = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your-anthropic-api-key-here');
  }

  async identify(request: AIIdentificationRequest): Promise<AIIdentificationResult> {
    if (!this.isAvailable) {
      throw new Error('Anthropic provider not configured. Set ANTHROPIC_API_KEY environment variable.');
    }
    throw new Error('Anthropic provider: implementation pending API key configuration.');
  }
}

// ============================================================
// AI Provider Registry — selects best available provider
// ============================================================

export class AIProviderRegistry {
  private providers: IAIProvider[];

  constructor() {
    this.providers = [
      new OpenAIProvider(),
      new GeminiProvider(),
      new AnthropicProvider(),
      new MockAIProvider(), // Always available as fallback
    ];
  }

  getDefaultProvider(): IAIProvider {
    // Use first available non-mock provider, fall back to mock
    const real = this.providers.find((p) => p.name !== 'mock' && p.isAvailable);
    return real ?? this.providers.find((p) => p.name === 'mock')!;
  }

  getProvider(type: AIProviderType): IAIProvider | undefined {
    return this.providers.find((p) => p.name === type);
  }

  listAvailable(): { name: AIProviderType; model: string; isAvailable: boolean }[] {
    return this.providers.map((p) => ({ name: p.name, model: p.model, isAvailable: p.isAvailable }));
  }
}

export const aiProviderRegistry = new AIProviderRegistry();
