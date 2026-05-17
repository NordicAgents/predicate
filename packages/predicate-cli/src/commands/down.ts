import { findComposeDir, dockerAvailable, compose } from '../docker.js';

export async function down(): Promise<number> {
  if (!dockerAvailable()) {
    console.error('Docker not found.');
    return 2;
  }
  const dir = findComposeDir();
  return compose(['down'], dir);
}
