import type { z } from 'zod';

// Parse tool input with a teaching error: instead of a raw ZodError dump, throw
// "<tool>: <field path> <message>" naming the first offending field.
export function parseInput<T>(schema: z.ZodType<T>, raw: unknown, toolName: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue && issue.path.length > 0 ? issue.path.join('.') : '(root)';
    const message = issue?.message ?? 'invalid input';
    throw new Error(`${toolName}: ${path} ${message}`);
  }
  return result.data;
}
