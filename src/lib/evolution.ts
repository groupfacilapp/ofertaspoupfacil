import type { WhatsAppClient, WAGroup, ConnectionState } from './whatsapp-client';

export type { ConnectionState };

/** @deprecated Use WAGroup from whatsapp-client */
export type EvolutionGroup = WAGroup;

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
      cache: 'no-store',
      // Hard timeout: prevents Vercel serverless from hanging when Evolution is slow/down.
      // 8s is generous for any Evolution API response; without this, functions time out at 25s.
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
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });
    // Evolution uses a global apikey — no per-instance token needed
    return { instanceName, status: 'disconnected' };
  }

  // providerToken is unused by Evolution (global apikey is used instead)
  async fetchQRCode(instanceName: string, _providerToken?: string): Promise<{ base64: string }> {
    return this.req(`/instance/connect/${instanceName}`);
  }

  async getConnectionState(instanceName: string, _providerToken?: string): Promise<{ instance: { state: ConnectionState } }> {
    return this.req(`/instance/connectionState/${instanceName}`);
  }

  async logoutInstance(instanceName: string, _providerToken?: string): Promise<void> {
    await this.req(`/instance/logout/${instanceName}`, { method: 'DELETE' });
  }

  async getAllInstances(): Promise<Array<{ name: string; state: ConnectionState; phoneNumber?: string }>> {
    const res = await this.req<any[]>('/instance/fetchInstances');
    
    if (!Array.isArray(res)) return [];

    const instances: Array<{ name: string; state: ConnectionState; phoneNumber?: string }> = [];

    for (const row of res) {
      if (!row) continue;
      const inst = row.instance || row;
      if (!inst) continue;

      const name = inst.instanceName || inst.name;
      if (!name || typeof name !== 'string') continue;

      let phoneNumber = undefined;
      if (inst.owner && typeof inst.owner === 'string') {
        phoneNumber = inst.owner.split('@')[0];
      }

      // Map raw API state to type-safe ConnectionState
      const rawState = (inst.state || inst.status || '').toLowerCase();
      let state: ConnectionState = 'close';
      if (rawState === 'open' || rawState === 'connected') {
        state = 'open';
      } else if (rawState === 'connecting' || rawState === 'qr_pending') {
        state = 'connecting';
      }

      instances.push({
        name,
        state,
        phoneNumber
      });
    }

    return instances;
  }

  async deleteInstance(instanceName: string, _providerToken?: string): Promise<void> {
    await this.req(`/instance/delete/${instanceName}`, { method: 'DELETE' });
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

  async fetchPairingCode(instanceName: string, phoneNumber: string, _providerToken?: string): Promise<{ code: string }> {
    // Evolution API v2: same endpoint as QR, but with ?number= returns pairing code instead
    const res = await this.req<{ pairingCode?: string; code?: string }>(
      `/instance/connect/${instanceName}?number=${encodeURIComponent(phoneNumber)}`
    );
    // `code` is the QR base64 — never use it as pairing code
    const code = res.pairingCode ?? '';
    if (!code) throw new Error('Evolution não retornou um código de pareamento. Verifique se o número está correto e tente novamente.');
    return { code };
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

  async sendImage(
    instanceName: string,
    groupJid: string,
    imageUrl: string,
    caption: string,
    _providerToken?: string
  ): Promise<void> {
    await this.req(`/message/sendMedia/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({
        number: groupJid,
        mediatype: 'image',
        media: imageUrl,
        caption,
      }),
    });
  }

  async ping(): Promise<boolean> {
    try {
      await fetch(`${this.url}/`, {
        headers: { apikey: this.apiKey },
        cache: 'no-store',
      });
      return true;
    } catch {
      return false;
    }
  }
}
