import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type {
  CompletionProvider,
  DecomposerCompletionRequest,
} from 'predicate-agent/src/index.js';

const SAMPLING_MODEL_HINT = 'claude-haiku';

/**
 * CompletionProvider that delegates to the MCP host via the `sampling/createMessage`
 * request. Only available when the connected client advertised the `sampling`
 * capability during initialization.
 */
export class SamplingProvider implements CompletionProvider {
  readonly kind = 'mcp-sampling' as const;

  constructor(private readonly server: Server) {}

  isAvailable(): boolean {
    const caps = this.server.getClientCapabilities();
    return Boolean(caps?.sampling);
  }

  async complete(req: DecomposerCompletionRequest): Promise<string> {
    const result = await this.server.createMessage({
      systemPrompt: `${req.systemPrompt}\n\n<tbox-slice>\n${req.tboxSlice}\n</tbox-slice>`,
      maxTokens: req.maxTokens,
      modelPreferences: {
        hints: [{ name: SAMPLING_MODEL_HINT }],
        intelligencePriority: 0.3,
        speedPriority: 0.7,
      },
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: `Question: ${req.question}\n\nReturn the JSON.` },
        },
      ],
    });
    const content = result.content;
    if (Array.isArray(content)) {
      return content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
    }
    if (content && typeof content === 'object' && 'type' in content && content.type === 'text') {
      return (content as { type: 'text'; text: string }).text;
    }
    return '';
  }
}
