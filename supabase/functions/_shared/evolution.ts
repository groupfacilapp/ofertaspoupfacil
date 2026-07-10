import type { WhatsAppClient, WAGroup, ConnectionState } from './whatsapp-client.ts';

export type { ConnectionState };

export class EvolutionClient implements WhatsAppClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  private get url(): string {
    return this.baseUrl.replace(/\/$/, '');
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.url}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
        ...init.headers,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`WhatsApp API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async createInstance(instanceName: string): Promise<{ instanceName: string; status: string; providerToken?: string }> {
    await this.req('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    });
    return { instanceName, status: 'disconnected' };
  }

  async getConnectionState(instanceName: string, _providerToken?: string): Promise<{ instance: { state: ConnectionState } }> {
    return this.req(`/instance/connectionState/${instanceName}`);
  }

  async fetchQRCode(instanceName: string, _providerToken?: string): Promise<{ base64: string }> {
    return this.req(`/instance/connect/${instanceName}`);
  }

  async fetchPairingCode(instanceName: string, phoneNumber: string, _providerToken?: string): Promise<{ code: string }> {
    const res = await this.req<{ pairingCode?: string }>(
      `/instance/connect/${instanceName}?number=${encodeURIComponent(phoneNumber)}`
    );
    const code = res.pairingCode ?? '';
    if (!code) throw new Error('Evolution não retornou um código de pareamento.');
    return { code };
  }

  async logoutInstance(instanceName: string, _providerToken?: string): Promise<void> {
    await this.req(`/instance/logout/${instanceName}`, { method: 'DELETE' });
  }

  async deleteInstance(instanceName: string, _providerToken?: string): Promise<void> {
    await this.req(`/instance/delete/${instanceName}`, { method: 'DELETE' });
  }

  async getAllInstances() {
    const res = await this.req<Array<{ instance: { instanceName: string; state: ConnectionState; owner?: string } }>>('/instance/fetchInstances');
    return res.map(row => ({
      name: row.instance.instanceName,
      state: row.instance.state,
      phoneNumber: row.instance.owner ? row.instance.owner.split('@')[0] : undefined,
    }));
  }

  async setWebhook(instanceName: string, webhookUrl: string, secret?: string, _providerToken?: string): Promise<void> {
    await this.req(`/webhook/set/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: true,
        events: ['CONNECTION_UPDATE', 'QRCODE_UPDATED'],
        ...(secret ? { headers: { apikey: secret } } : {}),
      }),
    });
  }

  async getGroups(instanceName: string, _providerToken?: string): Promise<WAGroup[]> {
    return this.req(`/group/fetchAllGroups/${instanceName}?getParticipants=false`, {
      signal: AbortSignal.timeout(55000),
    });
  }

  async getGroupByInvite(instanceName: string, inviteCode: string, _providerToken?: string): Promise<WAGroup> {
    return this.req(`/group/inviteInfo/${instanceName}?inviteCode=${encodeURIComponent(inviteCode)}`);
  }

  async sendText(instanceName: string, groupJid: string, text: string, _providerToken?: string): Promise<void> {
    await this.req(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ number: groupJid, text }),
    });
  }

  async sendImage(instanceName: string, groupJid: string, imageUrl: string, caption: string, _providerToken?: string): Promise<void> {
    await this.req(`/message/sendMedia/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ number: groupJid, mediatype: 'image', media: imageUrl, caption }),
    });
  }

  async ping(): Promise<boolean> {
    try {
      await fetch(`${this.url}/`, { headers: { apikey: this.apiKey }, signal: AbortSignal.timeout(5000) });
      return true;
    } catch {
      return false;
    }
  }
}
