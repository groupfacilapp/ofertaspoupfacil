// Import env at module load time — triggers Zod validation of process.env,
// throwing early if ENCRYPTION_KEY is missing or invalid.
import '@/lib/env';
import { encrypt, decrypt } from '@/lib/crypto';

/**
 * Serialize and encrypt marketplace credential data for storage in
 * marketplace_connections.encrypted_credentials (TEXT column).
 */
export function saveMarketplaceCredentials(
  data: Record<string, string>,
): string {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypt and deserialize marketplace credentials previously saved with
 * saveMarketplaceCredentials().
 */
export function loadMarketplaceCredentials(
  stored: string,
): Record<string, string> {
  return JSON.parse(decrypt(stored)) as Record<string, string>;
}

/**
 * Serialize and encrypt channel config data for storage in
 * channel_connections.encrypted_config (TEXT column).
 * Accepts wider value types than marketplace credentials.
 */
export function saveChannelConfig(data: Record<string, unknown>): string {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypt and deserialize channel config previously saved with
 * saveChannelConfig().
 */
export function loadChannelConfig(stored: string): Record<string, unknown> {
  return JSON.parse(decrypt(stored)) as Record<string, unknown>;
}
