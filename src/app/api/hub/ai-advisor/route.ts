import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o';

export async function POST(req: NextRequest) {
  try {
    const { speciesId, speciesName, question, mode } = await req.json();

    if (!question?.trim() || !speciesName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const systemPrompt = mode === 'advanced'
      ? `You are a senior seafood industry expert and marine biologist specializing in commercial seafood intelligence. 
You provide detailed, professional-grade analysis for seafood professionals, buyers, and suppliers.
Focus on: commercial viability, market dynamics, regulatory compliance, quality standards, sustainability, sourcing strategies, and trade regulations.
Be specific, cite relevant standards (EU, FDA, Codex Alimentarius), and provide actionable insights.
Always note when information requires verification with official sources.`
      : `You are a knowledgeable seafood advisor helping professionals understand seafood species.
Provide clear, accurate, and practical information about the species in question.
Keep responses concise but informative. Focus on practical commercial and biological information.
Always note when information requires verification with official sources.`;

    const userMessage = `Species: ${speciesName}
Question: ${question}

Please provide a ${mode === 'advanced' ? 'detailed professional' : 'clear and practical'} answer.`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: mode === 'advanced' ? 800 : 400,
      temperature: 0.7,
    });

    const answer = completion.choices[0]?.message?.content || 'No response generated.';

    return NextResponse.json({ answer, model: MODEL, mode });
  } catch (error: any) {
    console.error('[HubAIAdvisor] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'AI Advisor failed' },
      { status: 500 }
    );
  }
}
