import { findComposeDir, dockerAvailable, compose } from '../docker.js';

export async function up(): Promise<number> {
  if (!dockerAvailable()) {
    console.error('Docker not found. Install Docker Desktop or Docker Engine first.');
    return 2;
  }
  const dir = findComposeDir();
  console.log(`bringing Fuseki up from ${dir}`);
  return compose(['up', '-d'], dir);
}
