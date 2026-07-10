/**
 * Provider-agnostic WhatsApp client interface.
 * Both EvolutionClient and UazapiClient implement this.
 *
 * `providerToken` is used by UAZAPI (per-instance token) and ignored by Evolution
 * (which uses a global apikey configured at construction time).
 */

export type ConnectionState = 'open' | 'connecting' | 'close';

export interface WAGroup {
  id: string;      // group JID e.g. "120363...@g.us"
  subject: string; // group name
  size: number;
}

export interface WhatsAppClient {
  // Instance lifecycle
  createInstance(instanceName: string): Promise<{ instanceName: string; status: string; providerToken?: string }>;
  getConnectionState(instanceName: string, providerToken?: string): Promise<{ instance: { state: ConnectionState } }>;
  fetchQRCode(instanceName: string, providerToken?: string): Promise<{ base64: string }>;
  fetchPairingCode(instanceName: string, phone: string, providerToken?: string): Promise<{ code: string }>;
  logoutInstance(instanceName: string, providerToken?: string): Promise<void>;
  deleteInstance(instanceName: string, providerToken?: string): Promise<void>;
  setWebhook(instanceName: string, webhookUrl: string, secret?: string, providerToken?: string): Promise<void>;
  getAllInstances(): Promise<Array<{
    name: string;
    state: ConnectionState;
    phoneNumber?: string;
    createdAt?: string;
  }>>;

  // Groups
  getGroups(instanceName: string, providerToken?: string): Promise<WAGroup[]>;
  getGroupByInvite(instanceName: string, inviteCode: string, providerToken?: string): Promise<WAGroup>;

  // Messages
  sendText(instanceName: string, groupJid: string, text: string, providerToken?: string): Promise<void>;
  sendImage(instanceName: string, groupJid: string, imageUrl: string, caption: string, providerToken?: string): Promise<void>;

  // Health check
  ping(): Promise<boolean>;
}
