'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Smartphone, CheckCircle2, AlertCircle, RefreshCw, WifiOff, Wifi, QrCode, Hash, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { connectWhatsApp, connectByPhone, checkWhatsAppStatus, disconnectWhatsApp, deleteWhatsAppInstance } from '../actions';

type Status = 'idle' | 'loading' | 'qr_pending' | 'pairing' | 'connected' | 'error';
type Method = 'qr' | 'phone';

interface WhatsAppConnectProps {
  initialStatus: 'disconnected' | 'qr_pending' | 'connected' | 'error';
  initialQrCode?: string;
  instanceName: string;
}

function StatusLabel({ status }: { status: Status }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Conectado
      </span>
    );
  }
  if (status === 'qr_pending' || status === 'loading' || status === 'pairing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
        Aguardando confirmação
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
      Não conectado
    </span>
  );
}

export function WhatsAppConnect({ initialStatus, initialQrCode, instanceName }: WhatsAppConnectProps) {
  const [status, setStatus] = useState<Status>(
    initialStatus === 'qr_pending' ? 'qr_pending'
      : initialStatus === 'connected' ? 'connected'
      : 'idle'
  );
  const [method, setMethod] = useState<Method>('qr');
  const [qrCode, setQrCode] = useState<string | null>(initialQrCode ?? null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleConnectQR = () => {
    setError(null);
    startTransition(async () => {
      setStatus('loading');
      const res = await connectWhatsApp();
      if (res.status === 'connected') {
        setStatus('connected');
      } else if (res.status === 'qr_pending' && res.qrCode) {
        setQrCode(res.qrCode);
        setStatus('qr_pending');
      } else {
        setStatus('error');
        setError(res.error ?? 'Erro ao conectar');
      }
    });
  };

  const handleConnectPhone = () => {
    setError(null);
    startTransition(async () => {
      setStatus('loading');
      const res = await connectByPhone(phone);
      if (res.status === 'pairing' && res.pairingCode) {
        setPairingCode(res.pairingCode);
        setStatus('pairing');
      } else if (res.status === 'connected') {
        setStatus('connected');
      } else {
        setStatus('error');
        setError(res.error ?? 'Erro ao gerar código');
      }
    });
  };

  const handleDisconnect = () => {
    startTransition(async () => {
      await disconnectWhatsApp();
      setStatus('idle');
      setQrCode(null);
      setPairingCode(null);
      setPhone('');
    });
  };

  const handleDeleteInstance = () => {
    startTransition(async () => {
      await deleteWhatsAppInstance();
      setStatus('idle');
      setQrCode(null);
      setPairingCode(null);
      setPhone('');
      setError(null);
    });
  };

  const handleBack = (toMethod?: Method) => {
    setStatus('idle');
    setError(null);
    setQrCode(null);
    setPairingCode(null);
    if (toMethod) setMethod(toMethod);
  };

  const [pollErrors, setPollErrors] = useState(0);

  const poll = useCallback(async () => {
    try {
      const res = await checkWhatsAppStatus();
      setPollErrors(0);
      if (res.status === 'connected') {
        setStatus('connected');
        setQrCode(null);
        setPairingCode(null);
      } else if (res.status === 'disconnected' && status === 'connected') {
        setStatus('idle');
      } else if (res.qrCode && res.qrCode !== qrCode) {
        setQrCode(res.qrCode);
      }
    } catch {
      setPollErrors((n) => n + 1);
    }
  }, [qrCode, status]);

  // Polling durante qr/pairing (4s) e verificação periódica quando conectado (30s).
  // Para automaticamente após 5 erros consecutivos para evitar flood de timeouts.
  useEffect(() => {
    if (status !== 'qr_pending' && status !== 'pairing' && status !== 'connected') return;
    if (pollErrors >= 5) return; // Evolution indisponível — aguarda ação do usuário
    const interval = status === 'connected' ? 30_000 : 4_000;
    const id = setInterval(poll, interval);
    return () => clearInterval(id);
  }, [status, poll, pollErrors]);

  // Verificação imediata ao montar se já aparece conectado (confirma com a Evolution API)
  useEffect(() => {
    if (initialStatus !== 'connected') return;
    checkWhatsAppStatus().then((res) => {
      if (res.status === 'disconnected') setStatus('idle');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex flex-col rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-xl p-6 transition-all duration-300 hover:border-zinc-700/60 hover:shadow-xl overflow-hidden">
      {/* Subtle background glow based on status */}
      {status === 'connected' && (
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full blur-[80px] bg-gradient-to-tr from-emerald-500/20 to-emerald-600/20 opacity-30" />
      )}
      {(status === 'qr_pending' || status === 'pairing') && (
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full blur-[80px] bg-gradient-to-tr from-amber-500/20 to-amber-600/20 opacity-30" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Smartphone className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div className="flex flex-col gap-1 items-start justify-center">
            <p className="text-lg font-bold text-white tracking-tight">WhatsApp</p>
            <StatusLabel status={status} />
          </div>
        </div>
        {status === 'connected' && (
          <div className="flex h-8 w-8 items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
          </div>
        )}
      </div>

      {/* IDLE — method selector */}
      {status === 'idle' && (
        <>
          <div className="flex rounded-lg border border-zinc-800/60 bg-zinc-950/60 p-0.5 mb-4">
            <button
              type="button"
              onClick={() => setMethod('qr')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                method === 'qr' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <QrCode className="h-3.5 w-3.5" /> QR Code
            </button>
            <button
              type="button"
              onClick={() => setMethod('phone')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                method === 'phone' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Hash className="h-3.5 w-3.5" /> Código por número
            </button>
          </div>

          {method === 'qr' ? (
            <>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                Escaneie com o WhatsApp do número que vai fazer os disparos.{' '}
                <span className="font-mono text-[10px] text-zinc-600">{instanceName}</span>
              </p>
              <Button
                variant="outline" size="sm"
                className="w-full border-zinc-700/60 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100"
                onClick={handleConnectQR} disabled={isPending}
              >
                <Wifi className="h-3.5 w-3.5 mr-2" /> Gerar QR Code
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
                Digite o número com código do país. Um código de 8 caracteres será gerado para
                digitar em WhatsApp → Dispositivos conectados → Vincular com número.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="5511999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  maxLength={15}
                  className="bg-zinc-800/60 border-zinc-700/60 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:border-zinc-500 font-mono text-sm"
                />
                <Button
                  variant="outline" size="sm"
                  className="shrink-0 border-zinc-700/60 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100"
                  onClick={handleConnectPhone}
                  disabled={isPending || phone.length < 10}
                >
                  Gerar código
                </Button>
              </div>
            </>
          )}
          <Button
            variant="outline" size="sm"
            className="mt-3 w-full border-zinc-800/60 bg-transparent text-zinc-500 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400 transition-all"
            onClick={handleDeleteInstance} disabled={isPending}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Recriar instância
          </Button>
        </>
      )}

      {/* LOADING */}
      {status === 'loading' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <RefreshCw className="h-6 w-6 text-zinc-500 animate-spin" />
          <p className="text-xs text-zinc-500">
            {method === 'phone' ? 'Preparando instância...' : 'Gerando QR Code...'}
          </p>
        </div>
      )}

      {/* QR PENDING */}
      {status === 'qr_pending' && qrCode && (
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl bg-white p-3 shadow-lg">
            <img
              src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
              alt="QR Code WhatsApp" width={200} height={200} className="block"
            />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-zinc-300 mb-1">Escaneie com seu WhatsApp</p>
            <p className="text-xs text-zinc-600">
              WhatsApp → ⋮ → Dispositivos conectados → Conectar dispositivo
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <RefreshCw className="h-3 w-3 animate-spin" /> Aguardando leitura...
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleConnectQR}
              disabled={isPending}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 underline underline-offset-2 transition-colors disabled:opacity-40"
            >
              Gerar novo QR
            </button>
            <span className="text-zinc-800 text-[10px]">·</span>
            <button
              type="button"
              onClick={() => handleBack('phone')}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 underline underline-offset-2 transition-colors"
            >
              Usar código por número
            </button>
          </div>
        </div>
      )}

      {/* PAIRING CODE */}
      {status === 'pairing' && pairingCode && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/80 px-8 py-5 text-center">
            <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">Código de pareamento</p>
            <p className="text-3xl font-mono font-bold tracking-[0.3em] text-zinc-100">
              {pairingCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4)}-{pairingCode.replace(/[^a-zA-Z0-9]/g, '').slice(4, 8)}
            </p>
          </div>
          <div className="text-center space-y-1">
            <p className="text-xs font-medium text-zinc-300">Digite esse código no WhatsApp</p>
            <p className="text-xs text-zinc-600">
              WhatsApp → ⋮ → Dispositivos conectados → Vincular com número de telefone
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <RefreshCw className="h-3 w-3 animate-spin" /> Aguardando confirmação...
          </div>
          <button
            type="button"
            onClick={() => handleBack('qr')}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 underline underline-offset-2 transition-colors"
          >
            Usar QR Code em vez disso
          </button>
        </div>
      )}

      {/* CONNECTED */}
      {status === 'connected' && (
        <>
          <div className="flex items-center gap-2 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-emerald-400">Conectado com sucesso</p>
              <p className="text-xs text-zinc-600 mt-0.5 font-mono">{instanceName}</p>
            </div>
          </div>
          <Button
            variant="outline" size="sm"
            className="w-full border-zinc-700/60 bg-zinc-800/40 text-zinc-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all"
            onClick={handleDisconnect} disabled={isPending}
          >
            <WifiOff className="h-3.5 w-3.5 mr-2" /> Desconectar
          </Button>
          <Button
            variant="outline" size="sm"
            className="mt-2 w-full border-zinc-800/60 bg-transparent text-zinc-500 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400 transition-all"
            onClick={handleDeleteInstance} disabled={isPending}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Recriar instância
          </Button>
        </>
      )}

      {/* ERROR */}
      {status === 'error' && (
        <>
          <div className="flex items-start gap-2 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              className="flex-1 border-zinc-700/60 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/60"
              onClick={() => handleBack('qr')} disabled={isPending}
            >
              <QrCode className="h-3.5 w-3.5 mr-1.5" /> QR Code
            </Button>
            <Button
              variant="outline" size="sm"
              className="flex-1 border-zinc-700/60 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/60"
              onClick={() => handleBack('phone')} disabled={isPending}
            >
              <Hash className="h-3.5 w-3.5 mr-1.5" /> Por número
            </Button>
          </div>
          <Button
            variant="outline" size="sm"
            className="mt-3 w-full border-zinc-800/60 bg-transparent text-zinc-500 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400 transition-all"
            onClick={handleDeleteInstance} disabled={isPending}
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Recriar instância
          </Button>
        </>
      )}
    </div>
  );
}
