'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  LayoutDashboard,
  ShoppingBag,
  MessageCircle,
  Layers,
  Package,
  SlidersHorizontal,
  History,
  Settings,
  ShieldAlert,
  Crown,
  LogOut,
  Menu,
  X,
  ChevronDown,
  AlertTriangle,
  Clock,
  Send,
  Sun,
  Moon,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { BRAND } from '@/config/brand';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Marketplaces', href: '/marketplaces', icon: ShoppingBag },
  { label: 'Canais', href: '/canais', icon: MessageCircle },
  { label: 'Grupos', href: '/grupos', icon: Layers },
  { label: 'Produtos', href: '/produtos', icon: Package },
  { label: 'Automacoes', href: '/automacoes', icon: SlidersHorizontal },
  { label: 'Disparar', href: '/disparar', icon: Send },
  { label: 'Histórico', href: '/historico', icon: History },
  { label: 'Configurações', href: '/configuracoes', icon: Settings },
];

interface DashboardShellProps {
  children: React.ReactNode;
  isAdmin?: boolean;
  userDisplayName?: string | null;
  userEmail?: string | null;
  userPlan?: string;       // slug (e.g. 'trial', 'profissional_anual')
  planLabel?: string;      // nome from planos_sistema (e.g. 'Profissional Anual')
  planExpiresAt?: string | null;
  isExpired?: boolean;
}

// Pure presentational nav — no hooks, receives everything as props
function NavLinks({
  pathname,
  isAdmin,
  onLinkClick,
}: {
  pathname: string;
  isAdmin?: boolean;
  onLinkClick?: () => void;
}) {
  return (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onLinkClick}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
              isActive
                ? 'bg-indigo-600/10 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-300 border border-indigo-250 dark:border-indigo-500/20'
                : 'text-zinc-700 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-950 dark:hover:text-zinc-200 border border-transparent'
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4 shrink-0',
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-550'
              )}
            />
            {item.label}
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          href="/admin"
          onClick={onLinkClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 border mt-1',
            pathname.startsWith('/admin')
              ? 'bg-red-600/10 dark:bg-red-600/15 text-red-650 dark:text-red-400 border-red-200 dark:border-red-500/20'
              : 'text-zinc-500 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-300 border-transparent'
          )}
        >
          <ShieldAlert
            className={cn(
              'h-4 w-4 shrink-0',
              pathname.startsWith('/admin') ? 'text-red-600 dark:text-red-400' : 'text-zinc-450 dark:text-zinc-700'
            )}
          />
          Admin
        </Link>
      )}
    </>
  );
}

export function DashboardShell({
  children,
  isAdmin,
  userDisplayName,
  userEmail,
  userPlan = 'trial',
  planLabel = 'Teste Gratuito',
  planExpiresAt,
  isExpired = false,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

  function closeMobile() {
    setMobileOpen(false);
  }

  // Days remaining for trial/expiring plans
  const daysRemaining = planExpiresAt
    ? Math.max(0, Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / 86400000))
    : null;

  const isPro = userPlan !== 'trial' && !isExpired;
  const isTrial = userPlan === 'trial';

  // Shared sidebar bottom section
  function SidebarBottom() {
    return (
      <div className="px-3 py-3 border-t border-zinc-200 dark:border-zinc-800/60 space-y-2">
        {/* Plan badge */}
        {isExpired ? (
          <Link
            href="/planos"
            onClick={closeMobile}
            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-all"
          >
            <span className="text-[11px] text-red-400 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Plano expirado
            </span>
            <span className="text-[10px] font-semibold text-red-300">Renovar →</span>
          </Link>
        ) : isPro ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <Crown className="h-3 w-3 text-indigo-400 shrink-0" />
            <span className="text-[11px] font-semibold text-indigo-300">
              {planLabel}
            </span>
          </div>
        ) : isTrial && !isExpired && daysRemaining !== null && daysRemaining <= 3 ? (
          <Link
            href="/planos"
            onClick={closeMobile}
            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-all group"
          >
            <span className="text-[11px] text-amber-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {daysRemaining === 0 ? 'Expira hoje' : `${daysRemaining}d restantes`}
            </span>
            <span className="text-[10px] font-semibold text-amber-300">Ver planos →</span>
          </Link>
        ) : (
          <Link
            href="/planos"
            onClick={closeMobile}
            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800/60 hover:border-indigo-400 dark:hover:border-indigo-500/30 hover:bg-indigo-50/20 dark:hover:bg-indigo-500/5 transition-all group"
          >
            <span className="text-[11px] text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-300">
              {planLabel}
            </span>
            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-350">
              {isTrial ? 'Escolher plano →' : 'Upgrade →'}
            </span>
          </Link>
        )}

        {/* User row */}
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600/80 text-[11px] font-bold text-white">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{displayName}</p>
            {userEmail && <p className="text-[10px] text-zinc-600 dark:text-zinc-500 truncate">{userEmail}</p>}
          </div>
          <button
            onClick={handleLogout}
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors p-1 rounded"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background p-3 md:p-4 gap-4 transition-colors duration-300">
      {/* Desktop sidebar - Floating Glassmorphic */}
      <aside className="hidden md:flex w-[260px] flex-col rounded-2xl bg-card dark:bg-zinc-900/40 dark:backdrop-blur-xl border border-border dark:border-zinc-800/60 h-full shrink-0 shadow-2xl relative overflow-hidden transition-all duration-300">
        {/* Subtle top glow */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
        
        {/* Logo */}
        <div className="flex h-16 items-center px-6">
          <Logo size="sm" />
        </div>
        
        {/* Nav */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          <NavLinks pathname={pathname} isAdmin={isAdmin} />
        </nav>
        
        {/* Bottom Profile */}
        <SidebarBottom />
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeMobile}
          />
          <aside className="absolute left-3 top-3 bottom-3 w-64 bg-card dark:bg-zinc-900/90 dark:backdrop-blur-xl rounded-2xl border border-border dark:border-zinc-800/60 flex flex-col overflow-hidden shadow-2xl transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
            
            {/* Logo + close */}
            <div className="flex h-16 items-center px-5 justify-between">
              <Logo size="sm" />
              <button
                onClick={closeMobile}
                className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
              <NavLinks pathname={pathname} isAdmin={isAdmin} onLinkClick={closeMobile} />
            </nav>
            <SidebarBottom />
          </aside>
        </div>
      )}

      {/* Main content wrapper */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0 gap-4">
        {/* Floating Topbar */}
        <header className="flex h-16 rounded-2xl border border-border dark:border-zinc-800/60 bg-card dark:bg-zinc-900/30 dark:backdrop-blur-xl items-center justify-between px-5 shrink-0 shadow-lg transition-all duration-300">
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-4 md:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-zinc-400 hover:text-zinc-650 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Logo size="xs" />
          </div>

          <div className="hidden md:block flex-1">
            {/* Optional search or title area could go here, left blank as per design */}
          </div>

          {/* Theme switcher */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="mr-2 flex h-9 w-9 items-center justify-center rounded-xl border border-border dark:border-zinc-800/60 bg-card dark:bg-zinc-900/30 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all active:scale-95 outline-none"
              title="Alternar tema"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-orange-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-600" />
              )}
            </button>
          )}

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors outline-none border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800/40">
              <span className="hidden sm:block max-w-[140px] truncate font-medium">
                {displayName}
              </span>
              <Avatar className="h-7 w-7 ring-1 ring-zinc-200 dark:ring-zinc-800">
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl rounded-xl">
              <div className="px-3 py-2.5">
                <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                  {userDisplayName || displayName}
                </p>
                {userEmail && (
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{userEmail}</p>
                )}
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 uppercase tracking-wider font-semibold">{planLabel}</p>
              </div>
              <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
              <DropdownMenuItem
                onClick={() => router.push('/planos')}
                className="cursor-pointer text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white focus:bg-zinc-100 dark:focus:bg-zinc-800/60 focus:text-zinc-900 dark:focus:text-white gap-2 py-2"
              >
                <Crown className="h-4 w-4" />
                Meu plano
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white focus:bg-zinc-100 dark:focus:bg-zinc-800/60 focus:text-zinc-900 dark:focus:text-white gap-2 py-2"
              >
                <LogOut className="h-4 w-4" />
                Sair da conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto relative rounded-2xl h-full">
          {children}

          {/* Expired plan overlay (Do not block the plans page) */}
          {isExpired && !pathname.startsWith('/planos') && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md rounded-2xl">
              <div className="max-w-sm w-full mx-4 rounded-2xl border border-red-500/20 bg-zinc-900 p-8 text-center shadow-[0_0_50px_rgba(239,68,68,0.15)] ring-1 ring-white/5">
                <div className="flex justify-center mb-5">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="h-7 w-7 text-red-400" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Seu plano expirou</h2>
                <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
                  {userPlan === 'trial'
                    ? `Seu período de teste de ${BRAND.trial.days} dias encerrou. Escolha um plano para continuar usando o ${BRAND.name}.`
                    : `Seu plano expirou. Renove para continuar enviando ofertas automaticamente.`}
                </p>
                <Link
                  href="/planos"
                  className="inline-flex items-center justify-center w-full rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm px-6 py-3.5 transition-all shadow-lg shadow-indigo-500/25"
                >
                  Ver planos e renovar
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
