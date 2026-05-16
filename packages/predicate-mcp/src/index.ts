#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { SparqlClient } from './sparql/client.js';
import { buildTools } from './tools/registry.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new SparqlClient(config);
  const tools = buildTools(client);

  const server = new Server(
    { name: 'predicate-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

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
