export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getPlatformSetting } from '@/lib/platform-settings';
import { Users, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { BRAND } from '@/config/brand';

export default async function AdminOverviewPage() {
  const [
    { count: totalUsers },
    { count: connectedInstances },
    { count: disconnectedInstances },
    evoUrl,
  ] = await Promise.all([
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('whatsapp_instances')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'connected'),
    supabaseAdmin
      .from('whatsapp_instances')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'connected'),
    getPlatformSetting('evolution_api_url'),
  ]);

  const evoConfigured = !!evoUrl;

  const stats = [
    {
      label: 'Usuários cadastrados',
      value: totalUsers ?? 0,
      icon: Users,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
    },
    {
      label: 'WhatsApp conectados',
      value: connectedInstances ?? 0,
      icon: Wifi,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'WhatsApp desconectados',
      value: disconnectedInstances ?? 0,
      icon: WifiOff,
      color: 'text-zinc-400',
      bg: 'bg-zinc-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Visão Geral</h1>
        <p className="text-sm text-zinc-500 mt-1">Status da plataforma {BRAND.name}.</p>
      </div>

      {!evoConfigured && (
        <Link
          href="/admin/settings"
          className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 hover:bg-amber-500/10 transition-colors"
        >
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-400">
              Evolution API não configurada
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Configure a URL e API Key para ativar o WhatsApp &rarr; Clique aqui
            </p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  {stat.label}
                </p>
                <div className={`rounded-lg p-1.5 ${stat.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
