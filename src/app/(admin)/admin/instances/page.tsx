export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getWhatsAppClient, getPlatformSetting } from '@/lib/platform-settings';
import { CheckCircle2, WifiOff, Clock, RefreshCw, AlertTriangle } from 'lucide-react';

export default async function AdminInstancesPage() {
  let apiInstances: Array<{ name: string; state: string; phoneNumber?: string; createdAt?: string }> = [];
  let apiError: string | null = null;
  let providerStr = 'Evolution';

  const [dbInstancesRes, usersRes] = await Promise.all([
    supabaseAdmin.from('whatsapp_instances').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.auth.admin.listUsers()
  ]);

  try {
    const rawProvider = await getPlatformSetting('whatsapp_provider');
    if (rawProvider === 'evolutiongo') providerStr = 'Evolution GO';
    else if (rawProvider === 'uazapi') providerStr = 'UAZAPI';
    else providerStr = 'Evolution API';
    
    const client = await getWhatsAppClient();
    apiInstances = await client.getAllInstances();
  } catch (err: any) {
    console.error('Failed to load api instances', err);
    apiError = err.message || 'Erro de conexão com a API WhatsApp';
  }

  const dbInstances = dbInstancesRes.data ?? [];
  const users = usersRes.data.users ?? [];

  const userMap = new Map((users).map((u) => [u.id, u.email]));
  const dbInstanceUserMap = new Map(dbInstances.map(i => [i.instance_name, { userId: i.user_id, id: i.id }]));

  // Usar API primariamente, fallback para DB caso a API dê erro
  const isFallback = apiError !== null;
  const renderList = isFallback ? 
    dbInstances.map(i => ({
      id: i.id,
      name: i.instance_name,
      userId: i.user_id,
      state: i.status === 'connected' ? 'open' : (i.status === 'qr_pending' ? 'connecting' : 'close'),
      phoneNumber: i.phone_number,
      createdAt: i.connected_at
    }))
    : apiInstances.map(apiInst => {
        const dbMatching = dbInstanceUserMap.get(apiInst.name);
        return {
          id: dbMatching?.id || apiInst.name,
          name: apiInst.name,
          userId: dbMatching?.userId,
          state: apiInst.state,
          phoneNumber: apiInst.phoneNumber,
          createdAt: apiInst.createdAt
        };
      });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Instâncias WhatsApp</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {renderList.length} instâncias encontradas na API: <span className="font-medium text-zinc-300">{providerStr}</span>.
        </p>
      </div>

      {apiError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-300">
            <strong>Não foi possível obter dados ao vivo da API ({providerStr}):</strong> {apiError}.
            <br/> Exibindo dados em cache do banco de dados.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/60">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Usuário
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Instância {providerStr.split(' ')[0]}
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Número
              </th>
              {isFallback && (
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Conectado em (DB)
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {renderList.map((inst) => (
              <tr key={inst.id} className="hover:bg-zinc-800/20 transition-colors">
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {inst.userId && userMap.has(inst.userId) 
                    ? userMap.get(inst.userId) 
                    : (inst.userId ? inst.userId.slice(0, 8) + '...' : 'Usuário Desconhecido (Orphan)')}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400 font-mono">
                  {inst.name}
                </td>
                <td className="px-4 py-3">
                  {inst.state === 'open' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Conectado
                    </span>
                  ) : inst.state === 'connecting' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                      <Clock className="h-3 w-3" /> Aguardando / Conectando
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                      <WifiOff className="h-3 w-3" /> Desconectado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500 font-mono">
                  {inst.phoneNumber ?? '—'}
                </td>
                {isFallback && (
                  <td className="px-4 py-3 text-xs text-zinc-600">
                    {inst.createdAt
                      ? new Date(inst.createdAt).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                )}
              </tr>
            ))}
            {renderList.length === 0 && (
              <tr>
                <td
                  colSpan={5} // reduced by 1 because I removed creation date for api 
                  className="px-4 py-8 text-center text-xs text-zinc-600"
                >
                  Nenhuma instância encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
