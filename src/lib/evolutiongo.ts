import { randomBytes } from 'node:crypto';
import type { WhatsAppClient, WAGroup, ConnectionState } from './whatsapp-client';

/**
 * Evolution GO (whatsmeow-based) client.
 *
 * Auth model:
 * - Global ops (create, list, delete by id): `apikey: globalApiKey` header
 * - Per-instance ops (status, QR, send, groups, etc.): `apikey: instanceToken` header
 *
 * Key differences from Evolution API (original):
 * - Instance identified by token (not instanceName in path)
 * - No instanceName in any per-instance endpoint URL
 * - Groups returned as `{ data: [{ JID, Name, ... }] }` (not bare array)
 * - setWebhook uses POST /instance/connect (also initiates connection/QR)
 * - deleteInstance requires UUID — looked up from GET /instance/all
 */
export class EvolutionGoClient implements WhatsAppClient {
  constructor(
    private readonly baseUrl: string,
    private readonly globalApiKey: string
  ) {}

  private get url(): string {
    return this.baseUrl.replace(/\/$/, '');
  }

  private async req<T>(
    path: string,
    init: RequestInit = {},
    apiKeyOverride?: string
  ): Promise<T> {
    const res = await fetch(`${this.url}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKeyOverride ?? this.globalApiKey,
        ...((init.headers as Record<string, string>) ?? {}),
      },
      cache: 'no-store',
      signal:
        (init as RequestInit & { signal?: AbortSignal }).signal ??
        AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Evolution GO ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  // ─── Instance lifecycle ──────────────────────────────────────────────────────

  async createInstance(instanceName: string): Promise<{
    instanceName: string;
    status: string;
    providerToken?: string;
  }> {
    // Evolution GO requires the token in the body — WE define it at creation time.
    const token = randomBytes(24).toString('hex');

    await this.req<unknown>('/instance/create', {
      method: 'POST',
      body: JSON.stringify({ name: instanceName, token }),
    });

    return { instanceName, status: 'disconnected', providerToken: token };
  }

  async getConnectionState(
    _instanceName: string,
    providerToken?: string
  ): Promise<{ instance: { state: ConnectionState } }> {
    if (!providerToken) throw new Error('Evolution GO requer token de instância');

    const data = await this.req<{
      data?: { Connected?: boolean; LoggedIn?: boolean };
    }>('/instance/status', {}, providerToken);

    const connected = data.data?.Connected ?? false;
    const loggedIn = data.data?.LoggedIn ?? false;

    let state: ConnectionState;
    if (connected && loggedIn) state = 'open';
    else if (connected) state = 'connecting'; // socket up, QR not scanned
    else state = 'close';

    return { instance: { state } };
  }

  async fetchQRCode(
    _instanceName: string,
    providerToken?: string
  ): Promise<{ base64: string }> {
    if (!providerToken) throw new Error('Evolution GO requer token de instância');

    const data = await this.req<{
      data?: { Qrcode?: string; Code?: string };
    }>('/instance/qr', {}, providerToken);

    const qr = data.data?.Qrcode ?? '';
    return { base64: qr };
  }

  async fetchPairingCode(
    _instanceName: string,
    phone: string,
    providerToken?: string
  ): Promise<{ code: string }> {
    if (!providerToken) throw new Error('Evolution GO requer token de instância');

    const data = await this.req<{
      data?: { pairingCode?: string; code?: string; PairingCode?: string };
    }>('/instance/pair', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }, providerToken);

    const code =
      data.data?.pairingCode ??
      data.data?.PairingCode ??
      data.data?.code ??
      '';

    if (!code) {
      throw new Error(
        'Evolution GO não retornou um código de pareamento. Verifique se o número está correto.'
      );
    }
    return { code };
  }

  async logoutInstance(
    _instanceName: string,
    providerToken?: string
  ): Promise<void> {
    if (!providerToken) return;
    await this.req('/instance/logout', { method: 'DELETE' }, providerToken).catch(() => {});
  }

  async deleteInstance(
    instanceName: string,
    _providerToken?: string
  ): Promise<void> {
    // DELETE /instance/delete/{id} requires UUID — look up by name first
    const all = await this.req<{
      data?: Array<{ id?: string; name?: string }>;
    }>('/instance/all').catch(() => ({ data: [] }));

    const inst = (all.data ?? []).find((i) => i.name === instanceName);
    if (!inst?.id) return; // already gone

    await this.req(`/instance/delete/${inst.id}`, { method: 'DELETE' }).catch(() => {});
  }

  async setWebhook(
    _instanceName: string,
    webhookUrl: string,
    _secret?: string,
    providerToken?: string
  ): Promise<void> {
    if (!providerToken) return;

    // Include token in webhook URL so the handler can identify the instance
    const urlWithToken = `${webhookUrl}?token=${providerToken}`;

    await this.req('/instance/connect', {
      method: 'POST',
      body: JSON.stringify({
        webhookUrl: urlWithToken,
        subscribe: ['CONNECTION', 'MESSAGE'],
        immediate: true,
      }),
    }, providerToken).catch(() => {});
  }

  async getAllInstances() {
    const res = await this.req<{ data?: any[] }>('/instance/all');
    
    return (res.data || []).map((inst: any) => {
      let state: ConnectionState = 'close';
      if (inst.connected) state = 'open';
      else if (inst.qrcode) state = 'connecting';

      let phoneNumber = undefined;
      if (inst.jid) {
        phoneNumber = inst.jid.split('@')[0];
      }

      return {
        name: inst.name,
        state,
        phoneNumber,
        createdAt: inst.createdAt
      };
    });
  }

  // ─── Groups ──────────────────────────────────────────────────────────────────

  async getGroups(
    _instanceName: string,
    providerToken?: string
  ): Promise<WAGroup[]> {
    if (!providerToken) return [];

    const data = await this.req<
      | { data?: Array<{ JID?: string; Name?: string; Subject?: string; Participants?: unknown[] }> }
      | Array<{ JID?: string; Name?: string; Subject?: string; Participants?: unknown[] }>
    >('/group/list', { signal: AbortSignal.timeout(55000) } as RequestInit, providerToken).catch(() => ({ data: [] }));

    const list = Array.isArray(data)
      ? data
      : (data as { data?: unknown[] }).data ?? [];

    return (list as Array<{ JID?: string; Name?: string; Subject?: string; Participants?: unknown[] }>)
      .filter((g) => g.JID && /^\d+@g\.us$/.test(g.JID))
      .map((g) => ({
        id: g.JID!,
        subject: g.Name ?? g.Subject ?? '',
        size: g.Participants?.length ?? 0,
      }));
  }

  async getGroupByInvite(
    _instanceName: string,
    inviteCode: string,
    providerToken?: string
  ): Promise<WAGroup> {
    if (!providerToken) throw new Error('Evolution GO requer token de instância');

    // Evolution GO does not have a info-only endpoint for invite codes.
    // POST /group/join actually joins the group and returns its info.
    const data = await this.req<{
      data?: {
        JID?: string;
        GroupId?: string;
        groupId?: string;
        id?: string;
        Name?: string;
        Subject?: string;
      };
    }>('/group/join', {
      method: 'POST',
      body: JSON.stringify({ code: inviteCode }),
    }, providerToken);

    const jid =
      data.data?.JID ??
      data.data?.GroupId ??
      data.data?.groupId ??
      data.data?.id ??
      '';

    if (!jid) throw new Error('Grupo não encontrado. Verifique o link de convite.');

    return {
      id: jid,
      subject: data.data?.Name ?? data.data?.Subject ?? '',
      size: 0,
    };
  }

  // ─── Messages ────────────────────────────────────────────────────────────────

  async sendText(
    _instanceName: string,
    groupJid: string,
    text: string,
    providerToken?: string
  ): Promise<void> {
    if (!providerToken) throw new Error('Evolution GO requer token de instância');
    await this.req('/send/text', {
      method: 'POST',
      body: JSON.stringify({ number: groupJid, text }),
    }, providerToken);
  }

  async sendImage(
    _instanceName: string,
    groupJid: string,
    imageUrl: string,
    caption: string,
    providerToken?: string
  ): Promise<void> {
    if (!providerToken) throw new Error('Evolution GO requer token de instância');
    await this.req('/send/media', {
      method: 'POST',
      body: JSON.stringify({ number: groupJid, type: 'image', url: imageUrl, caption }),
    }, providerToken);
  }

  // ─── Health ───────────────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      await fetch(`${this.url}/instance/all`, {
        headers: { apikey: this.globalApiKey },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      return true;
    } catch {
      return false;
    }
  }
}
