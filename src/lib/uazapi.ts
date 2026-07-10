import type { WhatsAppClient, WAGroup, ConnectionState } from './whatsapp-client';

/**
 * UAZAPI (uazapiGO v2) client.
 *
 * Key architectural differences from Evolution:
 * - Auth: `admintoken` header for instance management; per-instance `token` for all other calls.
 * - Instance identity: identified by `token` header (not instanceName in URL path).
 * - State vocab: "connected" = Evolution "open", "disconnected" = Evolution "close".
 * - Groups: returned as { groups: [{ JID, Name, Participants[] }] }, not a bare array.
 * - Send endpoints are /send/text and /send/media (no instanceName in path).
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
      cache: 'no-store',
      signal: (init as RequestInit & { signal?: AbortSignal }).signal ?? AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`WhatsApp API ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  // ─── Instance lifecycle ───────────────────────────────────────────────────

  async createInstance(instanceName: string): Promise<{ instanceName: string; status: string; providerToken?: string }> {
    const data = await this.req<{
      instance?: { id?: string; token?: string; name?: string; status?: string };
      token?: string;
    }>('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ name: instanceName }),
    });

    const token = data.token ?? data.instance?.token;
    const status = data.instance?.status ?? 'disconnected';
    return { instanceName, status, providerToken: token };
  }

  async getConnectionState(instanceName: string, providerToken?: string): Promise<{ instance: { state: ConnectionState } }> {
    const data = await this.req<{
      instance?: { status?: string };
      status?: { connected?: boolean; loggedIn?: boolean };
    }>('/instance/status', {}, providerToken);

    // Map UAZAPI vocabulary to our internal ConnectionState (Evolution-compatible)
    const rawStatus = data.instance?.status ?? '';
    let state: ConnectionState;
    if (rawStatus === 'connected') {
      state = 'open';
    } else if (rawStatus === 'connecting') {
      state = 'connecting';
    } else {
      state = 'close';
    }

    return { instance: { state } };
  }

  async fetchQRCode(instanceName: string, providerToken?: string): Promise<{ base64: string }> {
    // Initiate connection (no phone = QR mode)
    const data = await this.req<{
      instance?: { qrcode?: string; status?: string };
    }>('/instance/connect', { method: 'POST', body: JSON.stringify({}) }, providerToken);

    const qrcode = data.instance?.qrcode ?? '';
    return { base64: qrcode };
  }

  async fetchPairingCode(instanceName: string, phone: string, providerToken?: string): Promise<{ code: string }> {
    const data = await this.req<{
      instance?: { paircode?: string; status?: string };
    }>('/instance/connect', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }, providerToken);

    const code = data.instance?.paircode ?? '';
    if (!code) throw new Error('UAZAPI não retornou um código de pareamento. Verifique se o número está correto.');
    return { code };
  }

  async logoutInstance(instanceName: string, providerToken?: string): Promise<void> {
    await this.req('/instance/disconnect', { method: 'POST', body: JSON.stringify({}) }, providerToken);
  }

  async getAllInstances() {
    // Assuming Uazapi returns similar structure to Evolution API
    const res = await this.req<Array<{ instance: { instanceName: string; state: ConnectionState; owner?: string } }>>('/instance/fetchInstances');
    
    return res.map(row => {
      let phoneNumber = undefined;
      if (row.instance.owner) {
        phoneNumber = row.instance.owner.split('@')[0];
      }
      return {
        name: row.instance.instanceName,
        state: row.instance.state,
        phoneNumber
      };
    });
  }

  async deleteInstance(instanceName: string, providerToken?: string): Promise<void> {
    await this.req('/instance', { method: 'DELETE' }, providerToken);
  }

  async setWebhook(instanceName: string, webhookUrl: string, _secret?: string, providerToken?: string): Promise<void> {
    await this.req('/webhook', {
      method: 'POST',
      body: JSON.stringify({
        url: webhookUrl,
        events: ['connection', 'messages'],
        enabled: true,
      }),
    }, providerToken);
  }

  // ─── Groups ──────────────────────────────────────────────────────────────

  async getGroups(instanceName: string, providerToken?: string): Promise<WAGroup[]> {
    const data = await this.req<{
      groups?: Array<{ JID?: string; Name?: string; Participants?: unknown[] }>;
    }>('/group/list?noparticipants=true', { signal: AbortSignal.timeout(55000) } as RequestInit, providerToken);

    return (data.groups ?? [])
      .filter((g) => g.JID && /^\d+@g\.us$/.test(g.JID))
      .map((g) => ({
        id: g.JID!,
        subject: g.Name ?? '',
        size: g.Participants?.length ?? 0,
      }));
  }

  async getGroupByInvite(instanceName: string, inviteCode: string, providerToken?: string): Promise<WAGroup> {
    const data = await this.req<{
      JID?: string; Name?: string; Participants?: unknown[];
    }>('/group/inviteInfo', {
      method: 'POST',
      body: JSON.stringify({ invitecode: inviteCode }),
    }, providerToken);

    if (!data.JID) throw new Error('Grupo não encontrado pelo link de convite.');
    return {
      id: data.JID,
      subject: data.Name ?? '',
      size: data.Participants?.length ?? 0,
    };
  }

  // ─── Messages ────────────────────────────────────────────────────────────

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

  // ─── Health ───────────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      await fetch(`${this.url}/`, {
        headers: { admintoken: this.adminToken },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      return true;
    } catch {
      return false;
    }
  }
}
