export class NotImplementedError extends Error {
  constructor(tool: string) {
    super(`${tool} is a Phase 1 stub; planned for a later phase`);
    this.name = 'NotImplementedError';
  }
}
