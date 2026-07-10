'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveAdminSettings, testWhatsAppConnection } from './actions';

const fieldClass =
  'bg-zinc-800/60 border-zinc-700/60 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:border-zinc-500 transition-colors';

const labelClass = 'text-xs font-medium text-zinc-400 uppercase tracking-wide';

export function SettingsForm({ settings }: { settings: Record<string, string> }) {
  const [values, setValues] = useState(settings);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const provider = values.whatsapp_provider ?? 'evolution';

  function onChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveAdminSettings(values);
      setResult(res);
    });
  }

  function handleTest() {
    startTransition(async () => {
      let url: string;
      let key: string;
      if (provider === 'uazapi') {
        url = values.uazapi_api_url;
        key = values.uazapi_admin_token;
      } else if (provider === 'evolutiongo') {
        url = values.evolutiongo_api_url;
        key = values.evolutiongo_api_key;
      } else {
        url = values.evolution_api_url;
        key = values.evolution_api_key;
      }
      const res = await testWhatsAppConnection(provider, url, key);
      setResult(res);
    });
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Provider selector */}
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">Provider WhatsApp</h2>
        <div className="flex gap-3 flex-wrap">
          {[
            { value: 'evolution', label: 'Evolution API' },
            { value: 'uazapi', label: 'UAZAPI' },
            { value: 'evolutiongo', label: 'Evolution GO' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange('whatsapp_provider', opt.value)}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                provider === opt.value
                  ? 'border-indigo-500/60 bg-indigo-500/10 text-indigo-300'
                  : 'border-zinc-700/60 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-600 leading-relaxed">
          {provider === 'uazapi'
            ? 'UAZAPI — sem limitação de grupos, paginação nativa, suporte a múltiplas instâncias.'
            : provider === 'evolutiongo'
            ? 'Evolution GO — baseado em whatsmeow, auth por token de instância.'
            : 'Evolution API — configuração atual. Troque para UAZAPI se tiver problemas de timeout.'}
        </p>
      </div>

      {/* Evolution API settings */}
      {provider === 'evolution' && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Evolution API</h2>
            <a
              href="https://doc.evolution-api.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-1.5">
            <Label className={labelClass}>URL da API</Label>
            <Input
              placeholder="https://evo.seudominio.com"
              value={values.evolution_api_url ?? ''}
              onChange={(e) => onChange('evolution_api_url', e.target.value)}
              className={fieldClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label className={labelClass}>API Key Global</Label>
            <Input
              type="password"
              placeholder="Sua API Key da Evolution"
              value={values.evolution_api_key ?? ''}
              onChange={(e) => onChange('evolution_api_key', e.target.value)}
              className={fieldClass}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isPending || !values.evolution_api_url || !values.evolution_api_key}
            className="border-zinc-700/60 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
            Testar Conexão
          </Button>
        </div>
      )}

      {/* UAZAPI settings */}
      {provider === 'uazapi' && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">UAZAPI</h2>
            <a
              href="https://docs.uazapi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-1.5">
            <Label className={labelClass}>URL da API</Label>
            <Input
              placeholder="https://api.uazapi.com"
              value={values.uazapi_api_url ?? ''}
              onChange={(e) => onChange('uazapi_api_url', e.target.value)}
              className={fieldClass}
            />
            <p className="text-xs text-zinc-600">
              Ex: <code className="text-zinc-500">https://free.uazapi.com</code> para a instância gratuita
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className={labelClass}>Admin Token</Label>
            <Input
              type="password"
              placeholder="Seu admintoken da UAZAPI"
              value={values.uazapi_admin_token ?? ''}
              onChange={(e) => onChange('uazapi_admin_token', e.target.value)}
              className={fieldClass}
            />
            <p className="text-xs text-zinc-600">
              Encontre em: painel UAZAPI → Settings → Admin Token
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isPending || !values.uazapi_api_url || !values.uazapi_admin_token}
            className="border-zinc-700/60 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
            Testar Conexão
          </Button>
        </div>
      )}

      {/* Evolution GO settings */}
      {provider === 'evolutiongo' && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Evolution GO</h2>
          </div>

          <div className="space-y-1.5">
            <Label className={labelClass}>URL da API</Label>
            <Input
              placeholder="https://evolutiongo.seudominio.com"
              value={values.evolutiongo_api_url ?? ''}
              onChange={(e) => onChange('evolutiongo_api_url', e.target.value)}
              className={fieldClass}
            />
          </div>

          <div className="space-y-1.5">
            <Label className={labelClass}>Global API Key</Label>
            <Input
              type="password"
              placeholder="Sua Global API Key da Evolution GO"
              value={values.evolutiongo_api_key ?? ''}
              onChange={(e) => onChange('evolutiongo_api_key', e.target.value)}
              className={fieldClass}
            />
            <p className="text-xs text-zinc-600">
              Encontre em: painel Evolution GO → Manager → API Key
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isPending || !values.evolutiongo_api_url || !values.evolutiongo_api_key}
            className="border-zinc-700/60 bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
            Testar Conexão
          </Button>
        </div>
      )}

      {result && (
        <div
          className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${
            result.ok
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          {result.message}
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="bg-zinc-100 text-zinc-900 hover:bg-white font-medium transition-colors"
      >
        {isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            Salvando...
          </>
        ) : (
          'Salvar configurações'
        )}
      </Button>
    </form>
  );
}
