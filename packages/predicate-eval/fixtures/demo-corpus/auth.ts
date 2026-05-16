import { verifyJwt } from './jwt';

export function login(token: string): boolean {
  return verifyJwt(token);
}
