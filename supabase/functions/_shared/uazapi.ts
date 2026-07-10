import type { WhatsAppClient, WAGroup, ConnectionState } from './whatsapp-client.ts';

/**
 * UAZAPI (uazapiGO v2) client — Deno/Edge Function version.
 * Mirrors src/lib/uazapi.ts exactly; kept separate due to dual runtime requirements.
 */
export class UazapiClient implements WhatsAppClient {
  constructor(
    private readonly baseUrl: string,
    private readonly adminToken: string
  ) {}

  private get url(): string {
    return this.baseUrl.replace(/\/$/, '');
  }

  private async req<T>(
    path: string,
    init: RequestInit = {},
    token?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { token } : { admintoken: this.adminToken }),
    };

    const res = await fetch(`${this.url}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
      signal: (init as RequestInit & { signal?: AbortSignal }).signal ?? AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`WhatsApp API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async createInstance(instanceName: string): Promise<{ instanceName: string; status: string; providerToken?: string }> {
    const data = await this.req<{
      instance?: { token?: string; status?: string };
      token?: string;
    }>('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ name: instanceName }),
    });
    const token = data.token ?? data.instance?.token;
    return { instanceName, status: data.instance?.status ?? 'disconnected', providerToken: token };
  }

  async getConnectionState(instanceName: string, providerToken?: string): Promise<{ instance: { state: ConnectionState } }> {
    const data = await this.req<{ instance?: { status?: string } }>('/instance/status', {}, providerToken);
    const rawStatus = data.instance?.status ?? '';
    const state: ConnectionState = rawStatus === 'connected' ? 'open' : rawStatus === 'connecting' ? 'connecting' : 'close';
    return { instance: { state } };
  }

  async fetchQRCode(instanceName: string, providerToken?: string): Promise<{ base64: string }> {
    const data = await this.req<{ instance?: { qrcode?: string } }>(
      '/instance/connect', { method: 'POST', body: JSON.stringify({}) }, providerToken
    );
    return { base64: data.instance?.qrcode ?? '' };
  }

  async fetchPairingCode(instanceName: string, phone: string, providerToken?: string): Promise<{ code: string }> {
    const data = await this.req<{ instance?: { paircode?: string } }>(
      '/instance/connect', { method: 'POST', body: JSON.stringify({ phone }) }, providerToken
    );
    const code = data.instance?.paircode ?? '';
    if (!code) throw new Error('UAZAPI não retornou um código de pareamento.');
    return { code };
  }

  async logoutInstance(instanceName: string, providerToken?: string): Promise<void> {
    await this.req('/instance/disconnect', { method: 'POST', body: JSON.stringify({}) }, providerToken);
  }

  async deleteInstance(instanceName: string, providerToken?: string): Promise<void> {
    await this.req('/instance', { method: 'DELETE' }, providerToken);
  }

  async getAllInstances() {
    const res = await this.req<Array<{ instance: { instanceName: string; state: ConnectionState; owner?: string } }>>('/instance/fetchInstances');
    return res.map(row => ({
      name: row.instance.instanceName,
      state: row.instance.state,
      phoneNumber: row.instance.owner ? row.instance.owner.split('@')[0] : undefined,
    }));
  }

  async setWebhook(instanceName: string, webhookUrl: string, _secret?: string, providerToken?: string): Promise<void> {
    await this.req('/webhook', {
      method: 'POST',
      body: JSON.stringify({ url: webhookUrl, events: ['connection', 'messages'], enabled: true }),
    }, providerToken);
  }

  async getGroups(instanceName: string, providerToken?: string): Promise<WAGroup[]> {
    const data = await this.req<{ groups?: Array<{ JID?: string; Name?: string; Participants?: unknown[] }> }>(
      '/group/list?noparticipants=true',
      { signal: AbortSignal.timeout(55000) } as RequestInit,
      providerToken
    );
    return (data.groups ?? [])
      .filter((g) => g.JID && /^\d+@g\.us$/.test(g.JID))
      .map((g) => ({ id: g.JID!, subject: g.Name ?? '', size: g.Participants?.length ?? 0 }));
  }

  async getGroupByInvite(instanceName: string, inviteCode: string, providerToken?: string): Promise<WAGroup> {
    const data = await this.req<{ JID?: string; Name?: string; Participants?: unknown[] }>(
      '/group/inviteInfo', { method: 'POST', body: JSON.stringify({ invitecode: inviteCode }) }, providerToken
    );
    if (!data.JID) throw new Error('Grupo não encontrado pelo link de convite.');
    return { id: data.JID, subject: data.Name ?? '', size: data.Participants?.length ?? 0 };
  }

  async sendText(instanceName: string, groupJid: string, text: string, providerToken?: string): Promise<void> {
    await this.req('/send/text', {
      method: 'POST',
      body: JSON.stringify({ number: groupJid, text }),
    }, providerToken);
  }

  async sendImage(instanceName: string, groupJid: string, imageUrl: string, caption: string, providerToken?: string): Promise<void> {
    await this.req('/send/media', {
      method: 'POST',
      body: JSON.stringify({ number: groupJid, type: 'image', file: imageUrl, text: caption }),
    }, providerToken);
  }

  async ping(): Promise<boolean> {
    try {
      await fetch(`${this.url}/`, {
        headers: { admintoken: this.adminToken },
        signal: AbortSignal.timeout(5000),
      });
      return true;
    } catch {
      return false;
    }
  }
}
