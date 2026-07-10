import { encrypt, decrypt } from './crypto.ts';

export function saveMarketplaceCredentials(data: Record<string, string>): string {
  return encrypt(JSON.stringify(data));
}

export function loadMarketplaceCredentials(stored: string): Record<string, string> {
  return JSON.parse(decrypt(stored)) as Record<string, string>;
}

export function saveChannelConfig(data: Record<string, unknown>): string {
  return encrypt(JSON.stringify(data));
}

export function loadChannelConfig(stored: string): Record<string, unknown> {
  return JSON.parse(decrypt(stored)) as Record<string, unknown>;
}
