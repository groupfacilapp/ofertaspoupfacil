export class TelegramClient {
  private baseUrl: string;

  constructor(private token: string) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
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
      await this.sendMessage(chatId, caption);
    }
  }
}

export function formatForTelegram(waMessage: string): string {
  return (
    waMessage
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
      .replace(/~([^~\n]+)~/g, '<s>$1</s>')
      .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, '<i>$1</i>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
  );
}
