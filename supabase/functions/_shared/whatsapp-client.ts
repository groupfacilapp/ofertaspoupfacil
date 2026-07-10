/**
 * Provider-agnostic WhatsApp client interface — Deno/Edge Function version.
 * Mirrors src/lib/whatsapp-client.ts exactly.
 */

export type ConnectionState = 'open' | 'connecting' | 'close';

export interface WAGroup {
  id: string;
  subject: string;
  size: number;
}

export interface WhatsAppClient {
  createInstance(instanceName: string): Promise<{ instanceName: string; status: string; providerToken?: string }>;
  getConnectionState(instanceName: string, providerToken?: string): Promise<{ instance: { state: ConnectionState } }>;
  fetchQRCode(instanceName: string, providerToken?: string): Promise<{ base64: string }>;
  fetchPairingCode(instanceName: string, phone: string, providerToken?: string): Promise<{ code: string }>;
  logoutInstance(instanceName: string, providerToken?: string): Promise<void>;
  deleteInstance(instanceName: string, providerToken?: string): Promise<void>;
  setWebhook(instanceName: string, webhookUrl: string, secret?: string, providerToken?: string): Promise<void>;
  getAllInstances(): Promise<Array<{ name: string; state: ConnectionState; phoneNumber?: string; createdAt?: string }>>;
  getGroups(instanceName: string, providerToken?: string): Promise<WAGroup[]>;
  getGroupByInvite(instanceName: string, inviteCode: string, providerToken?: string): Promise<WAGroup>;
  sendText(instanceName: string, groupJid: string, text: string, providerToken?: string): Promise<void>;
  sendImage(instanceName: string, groupJid: string, imageUrl: string, caption: string, providerToken?: string): Promise<void>;
  ping(): Promise<boolean>;
}
