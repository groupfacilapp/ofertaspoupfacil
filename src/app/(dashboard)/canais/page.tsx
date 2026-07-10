export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { makeInstanceName, getWhatsAppClient } from '@/lib/platform-settings';
import { WhatsAppConnect } from './components/WhatsAppConnect';
import { TelegramConnect } from './components/TelegramConnect';
import { AlertTriangle, Info } from 'lucide-react';

export default async function CanaisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const instanceName = await makeInstanceName(user!.id);

  const [{ data: whatsappInstance }, { data: telegramConn }] = await Promise.all([
    supabaseAdmin
      .from('whatsapp_instances')
      .select('status, qr_code, phone_number, provider_token')
      .eq('user_id', user!.id)
      .maybeSingle(),
    supabaseAdmin
      .from('channel_connections')
      .select('is_connected, label')
      .eq('user_id', user!.id)
      .eq('channel_type', 'telegram')
      .order('last_status_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Se o banco diz "conectado", confirma com a Evolution antes de renderizar
  let whatsappStatus = (whatsappInstance?.status as 'disconnected' | 'qr_pending' | 'connected' | 'error') ?? 'disconnected';
  if (whatsappStatus === 'connected') {
    try {
      const wa = await getWhatsAppClient();
      const providerToken = whatsappInstance?.provider_token ?? undefined;
      const state = await wa.getConnectionState(instanceName, providerToken);
      if (state.instance.state !== 'open') {
        await supabaseAdmin
          .from('whatsapp_instances')
          .update({
            status: 'disconnected',
            disconnected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user!.id);
        whatsappStatus = 'disconnected';
      }
    } catch {
      // Evolution inacessível — mantém status do banco
    }
  }

  return (
    <div className="space-y-6 max-w-5xl md:px-2 md:py-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">Canais de Disparo</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Conecte seus canais de mensagem para receber os achadinhos automaticamente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
        <WhatsAppConnect
          initialStatus={whatsappStatus}
          initialQrCode={whatsappInstance?.qr_code ?? undefined}
          instanceName={instanceName}
        />

        <TelegramConnect
          initialConnected={telegramConn?.is_connected ?? false}
          initialBotLabel={telegramConn?.label ?? null}
        />
      </div>

      {/* Safety guide */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md p-6 shadow-[0_0_20px_-5px_rgba(245,158,11,0.1)] relative overflow-hidden">
        <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-amber-500/10 blur-[40px]" />
        <div className="flex items-center gap-3 mb-4 relative z-10">
          <div className="rounded-lg bg-amber-500/20 p-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          </div>
          <h3 className="text-sm font-bold text-amber-500 tracking-wide uppercase">
            Boas práticas — leia antes de usar
          </h3>
        </div>
        <ul className="space-y-3 text-sm text-zinc-400 relative z-10 pl-2">
          <li className="flex items-start gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <span className="leading-relaxed">
              Use um número{' '}
              <strong className="text-zinc-200">dedicado</strong> para disparos — não
              seu WhatsApp pessoal.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <span className="leading-relaxed">
              Disparos são feitos{' '}
              <strong className="text-zinc-200">somente em grupos</strong> dos quais seu
              número já é membro.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <span className="leading-relaxed">
              O sistema tem{' '}
              <strong className="text-zinc-200">rate limiting automático</strong> — respeite
              os limites para evitar banimento.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <span className="leading-relaxed">
              Se o número for banido, reconecte um novo número. O histórico é mantido.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <span className="leading-relaxed">
              Nunca envie para contatos individuais — apenas para seus grupos de ofertas.
            </span>
          </li>
        </ul>
      </div>

      {/* Instance info */}
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:bg-zinc-900/60 hover:border-zinc-700/60 transition-colors">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Info className="h-4 w-4 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
            <p className="text-sm font-bold text-zinc-400 tracking-wide uppercase group-hover:text-zinc-300 transition-colors">Sua Instância na API</p>
          </div>
          <p className="text-xs text-zinc-500">
            Use este ID para identificar sua conexão no painel avançado se necessário.
          </p>
        </div>
        <div className="bg-black/40 border border-zinc-800 rounded-lg px-4 py-3 flex items-center justify-center min-w-[200px]">
          <code className="text-indigo-400 font-mono text-sm tracking-wider font-bold">{instanceName}</code>
        </div>
      </div>
    </div>
  );
}
