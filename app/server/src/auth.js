'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const N = 16384, R = 8, P = 1, KEYLEN = 64;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}
async function verifyPassword(password, stored) {
  const [alg, n, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: +n, r: +r, p: +p });
  return crypto.timingSafeEqual(key, expected);
}
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
function newToken() { const token = crypto.randomBytes(32).toString('base64url'); return { token, tokenHash: sha256(token) }; }
// Verified against when the email is unknown, so "wrong email" and "wrong password" take the same time.
const dummyHash = hashPassword('not-a-real-password-' + crypto.randomUUID());
module.exports = { hashPassword, verifyPassword, newToken, sha256, dummyHash };
