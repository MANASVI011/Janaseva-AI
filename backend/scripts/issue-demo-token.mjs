import 'dotenv/config';
import { createHmac } from 'node:crypto';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo officer tokens cannot be issued in production.');
}

const secret = process.env.DOCUMENT_VERIFICATION_JWT_SECRET;
if (!secret || Buffer.byteLength(secret) < 32) {
  throw new Error(
    'Set DOCUMENT_VERIFICATION_JWT_SECRET to at least 32 random bytes.',
  );
}

const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
const header = encode({ alg: 'HS256', typ: 'JWT' });
const claims = encode({
  sub: 'demo-caseworker',
  role: 'CASEWORKER',
  iss: process.env.DOCUMENT_VERIFICATION_JWT_ISSUER ?? 'janaseva-ai-auth',
  exp: Math.floor(Date.now() / 1000) + 30 * 60,
});
const signature = createHmac('sha256', secret)
  .update(`${header}.${claims}`)
  .digest('base64url');
console.log(`${header}.${claims}.${signature}`);
