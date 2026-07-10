'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Users, Wifi, LayoutDashboard, ChevronLeft, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Configurações', href: '/admin/settings', icon: Settings },
  { label: 'Instâncias', href: '/admin/instances', icon: Wifi },
  { label: 'Usuários', href: '/admin/users', icon: Users },
  { label: 'Planos', href: '/admin/plans', icon: CreditCard },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 flex-col bg-zinc-950 border-r border-zinc-800/60 h-screen shrink-0">
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-zinc-800/60">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-red-600">
          <span className="text-[10px] font-bold text-white">A</span>
        </div>
        <span className="text-sm font-semibold text-zinc-200">Painel Admin</span>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all border',
                isActive
                  ? 'bg-red-600/10 text-red-400 border-red-500/20'
                  : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border-transparent'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  isActive ? 'text-red-400' : 'text-zinc-500'
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-zinc-800/60">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
          Voltar ao app
        </Link>
      </div>
    </aside>
  );
}
