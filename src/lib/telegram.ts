/**
 * Telegram Bot API client for sending messages to groups/channels.
 */

export interface TelegramBotInfo {
  id: number;
  username: string;
  first_name: string;
}

export interface TelegramChatInfo {
  id: number;
  title?: string;
  type: 'group' | 'supergroup' | 'channel' | 'private';
  username?: string;
}

export class TelegramClient {
  private baseUrl: string;

  constructor(private token: string) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async getMe(): Promise<TelegramBotInfo> {
    const res = await fetch(`${this.baseUrl}/getMe`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.description ?? 'Token inválido');
    return data.result as TelegramBotInfo;
  }

  async getChat(chatId: string): Promise<TelegramChatInfo> {
    const res = await fetch(`${this.baseUrl}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description ?? 'Chat não encontrado. Verifique o ID e se o bot foi adicionado ao grupo.');
    return data.result as TelegramChatInfo;
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description ?? 'Falha ao enviar mensagem Telegram');
  }

  async sendPhoto(chatId: string, photoUrl: string, caption: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML' }),
    });
    const data = await res.json();
    if (!data.ok) {
      // Photo URL failed (e.g. expired CDN link) — fall back to text-only
      await this.sendMessage(chatId, caption);
    }
  }
}

/**
 * Convert WhatsApp-style markdown to Telegram HTML parse_mode.
 *
 * WA format used in templates:
 *   *bold*  ~strikethrough~  _italic_  `code`
 *
 * Telegram HTML:
 *   <b>bold</b>  <s>strikethrough</s>  <i>italic</i>  <code>code</code>
 *
 * Also escapes & < > so product titles/prices don't break HTML.
 */
export function formatForTelegram(waMessage: string): string {
  return (
    waMessage
      // 1. Escape HTML special characters first (before adding tags)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // 2. Bold: *text*  →  <b>text</b>
      .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
      // 3. Strikethrough: ~text~  →  <s>text</s>
      .replace(/~([^~\n]+)~/g, '<s>$1</s>')
      // 4. Italic: _text_  →  <i>text</i>  (only word boundaries to avoid URLs)
      .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<i>$1</i>')
      // 5. Code: `text`  →  <code>text</code>
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
  );
}
