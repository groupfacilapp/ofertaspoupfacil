import { describe, it, expect, beforeAll } from 'vitest';

// Set test encryption key before importing module
beforeAll(() => {
  // 32 bytes = 64 hex chars
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
});

describe('crypto module', () => {
  it('encrypt returns iv:tag:ciphertext format', async () => {
    const { encrypt } = await import('@/lib/crypto');
    const result = encrypt('test-secret');
    const parts = result.split(':');
    expect(parts).toHaveLength(3);
    // Each part should be valid base64
    parts.forEach(part => {
      expect(() => Buffer.from(part, 'base64')).not.toThrow();
    });
  });

  it('decrypt returns original plaintext', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto');
    const plaintext = 'my-secret-credential-value';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext for same input (random IV)', async () => {
    const { encrypt } = await import('@/lib/crypto');
    const plaintext = 'same-input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it('throws on tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto');
    const encrypted = encrypt('secret');
    const parts = encrypted.split(':');
    // Tamper with the ciphertext portion
    parts[2] = Buffer.from('tampered').toString('base64');
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('throws on truncated input', async () => {
    const { decrypt } = await import('@/lib/crypto');
    expect(() => decrypt('invalid')).toThrow();
  });

  it('roundtrips JSON strings', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto');
    const credentials = JSON.stringify({
      cookies: 'session=abc123; token=xyz',
      tag: 'my-affiliate-tag',
    });
    expect(decrypt(encrypt(credentials))).toBe(credentials);
  });

  it('handles special characters', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto');
    const special = 'Acao de gracas: cafe com acucar! \n\t Emojis too';
    expect(decrypt(encrypt(special))).toBe(special);
  });
});
