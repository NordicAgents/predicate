import Anthropic from '@anthropic-ai/sdk';

export interface DecomposerCompletionRequest {
  systemPrompt: string;
  tboxSlice: string;
  question: string;
  maxTokens: number;
}

export type CompletionProviderKind = 'mcp-sampling' | 'anthropic-sdk';

export interface CompletionProvider {
  kind: CompletionProviderKind;
  isAvailable(): boolean;
  complete(req: DecomposerCompletionRequest): Promise<string>;
}

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

export class AnthropicSdkProvider implements CompletionProvider {
  readonly kind = 'anthropic-sdk' as const;

  isAvailable(): boolean {
    return Boolean(process.env['ANTHROPIC_API_KEY']);
  }

  async complete(req: DecomposerCompletionRequest): Promise<string> {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: req.maxTokens,
      system: [
        { type: 'text', text: req.systemPrompt },
        {
          type: 'text',
          text: `<tbox-slice>\n${req.tboxSlice}\n</tbox-slice>`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: `Question: ${req.question}\n\nReturn the JSON.` }],
    });
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n');
  }
}
