'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  MessageCircle,
  Layers,
  Package,
  SlidersHorizontal,
  History,
  Settings,
  Zap,
  ShieldAlert,
  Crown,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Marketplaces', href: '/marketplaces', icon: ShoppingBag },
  { label: 'Canais', href: '/canais', icon: MessageCircle },
  { label: 'Grupos', href: '/grupos', icon: Layers },
  { label: 'Produtos', href: '/produtos', icon: Package },
  { label: 'Automacoes', href: '/automacoes', icon: SlidersHorizontal },
  { label: 'Histórico', href: '/historico', icon: History },
  { label: 'Configurações', href: '/configuracoes', icon: Settings },
];

interface SidebarProps {
  isAdmin?: boolean;
  userDisplayName?: string | null;
  userEmail?: string | null;
  userPlan?: 'free' | 'pro';
}

export function Sidebar({ isAdmin, userDisplayName, userEmail, userPlan = 'free' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const displayName = userDisplayName || userEmail?.split('@')[0] || 'Usuário';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="hidden md:flex w-60 flex-col bg-zinc-950 border-r border-zinc-800/60 h-screen shrink-0">
      {/* Logo */}
      <div className="flex h-14 items-center px-5 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 shadow-md shadow-indigo-500/30">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight">
            <span className="text-indigo-400">Dispara</span>
            <span className="text-white">Zap</span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/20'
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  isActive ? 'text-indigo-400' : 'text-zinc-500'
                )}
              />
              {item.label}
            </Link>
          );
        })}

        {/* Admin */}
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 border mt-1',
              pathname.startsWith('/admin')
                ? 'bg-red-600/15 text-red-400 border-red-500/20'
                : 'text-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-300 border-transparent'
            )}
          >
            <ShieldAlert className={cn('h-4 w-4 shrink-0', pathname.startsWith('/admin') ? 'text-red-400' : 'text-zinc-700')} />
            Admin
          </Link>
        )}
      </nav>

      {/* User info + plan */}
      <div className="px-3 py-3 border-t border-zinc-800/60 space-y-2">
        {/* Plan badge */}
        {userPlan === 'pro' ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <Crown className="h-3 w-3 text-indigo-400 shrink-0" />
            <span className="text-[11px] font-semibold text-indigo-300">Plano Pro</span>
          </div>
        ) : (
          <Link
            href="/configuracoes"
            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-800/40 border border-zinc-800/60 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group"
          >
            <span className="text-[11px] text-zinc-500 group-hover:text-zinc-400">Plano Free</span>
            <span className="text-[10px] font-semibold text-indigo-400 group-hover:text-indigo-300">Upgrade →</span>
          </Link>
        )}

        {/* User row */}
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600/80 text-[11px] font-bold text-white">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-200 truncate">{displayName}</p>
            {userEmail && <p className="text-[10px] text-zinc-600 truncate">{userEmail}</p>}
          </div>
          <button
            onClick={handleLogout}
            className="text-zinc-700 hover:text-zinc-400 transition-colors p-1 rounded"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
