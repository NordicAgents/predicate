const SECRET = process.env.JWT_SECRET ?? '';

export function verifyJwt(token: string): boolean {
  return token.length > 0 && SECRET.length > 0;
}
