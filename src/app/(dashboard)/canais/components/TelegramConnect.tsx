'use client';

import { useState, useTransition } from 'react';
import { Bot, CheckCircle2, Loader2, X, AlertCircle, ExternalLink } from 'lucide-react';
import { connectTelegram, disconnectTelegram } from '../actions';

interface TelegramConnectProps {
  initialConnected: boolean;
  initialBotLabel: string | null;
}

export function TelegramConnect({ initialConnected, initialBotLabel }: TelegramConnectProps) {
  const [connected, setConnected] = useState(initialConnected);
  const [botLabel, setBotLabel] = useState(initialBotLabel);
  const [showForm, setShowForm] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await connectTelegram(token);
      if (res.ok) {
        setConnected(true);
        setBotLabel(`@${res.botUsername}`);
        setShowForm(false);
        setToken('');
      } else {
        setError(res.error ?? 'Erro ao conectar');
      }
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectTelegram();
      setConnected(false);
      setBotLabel(null);
    });
  }

  return (
    <div className="relative flex flex-col rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-xl p-6 transition-all duration-300 hover:border-zinc-700/60 hover:shadow-xl overflow-hidden">
      {/* Subtle background glow based on status */}
      {connected ? (
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full blur-[80px] bg-gradient-to-tr from-sky-500/20 to-sky-600/20 opacity-30" />
      ) : (
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full blur-[80px] bg-gradient-to-tr from-zinc-500/10 to-zinc-600/10 opacity-30" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <Bot className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-1 items-start justify-center">
            <p className="text-lg font-bold text-white tracking-tight">Telegram</p>
            {connected ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                Conectado {botLabel && `· ${botLabel}`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                Não conectado
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
      {connected ? (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 leading-relaxed">
            Bot conectado com sucesso. Adicione-o a seus grupos/canais Telegram e configure os destinos em <strong className="text-zinc-400">Grupos de Disparo</strong>.
          </p>
          <button
            onClick={handleDisconnect}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Desconectar bot
          </button>
        </div>
      ) : showForm ? (
        <form onSubmit={handleConnect} className="space-y-3">
          <div>
            <p className="text-xs text-zinc-500 mb-2 leading-relaxed">
              Crie um bot via{' '}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-0.5"
              >
                @BotFather <ExternalLink className="h-2.5 w-2.5" />
              </a>{' '}
              e cole o token abaixo.
            </p>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="1234567890:ABCDEFghijklmnopqrstuvwxyz"
              className="w-full rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/60 transition-colors font-mono"
              required
            />
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending || !token.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-3 py-2 transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Conectar
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); setToken(''); }}
              className="px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 leading-relaxed">
            Conecte um bot do Telegram para disparar achadinhos em grupos e canais.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="w-full rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-400 hover:bg-sky-500/15 hover:border-sky-500/50 transition-all font-medium"
          >
            Conectar bot Telegram
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
