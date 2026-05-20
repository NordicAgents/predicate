#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getAdapter } from './storage/index.js';
import { buildTools } from './tools/registry.js';
import { SamplingProvider } from './sampling-provider.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';

async function main(): Promise<void> {
  const client = getAdapter();

  const server = new Server(
    { name: 'predicate-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  // SamplingProvider checks server.getClientCapabilities() lazily on each
  // decompose() call, so it's safe to install before the client has connected.
  const tools = buildTools(client, {
    extraCompletionProviders: [new SamplingProvider(server)],
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema as z.ZodTypeAny),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = tools.find((t) => t.name === req.params.name);
    if (!tool) throw new Error(`Unknown tool: ${req.params.name}`);
    const result = await tool.handler(req.params.arguments);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
  });

  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
