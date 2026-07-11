'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, ChevronDown, Sun, Moon } from 'lucide-react';

interface TopbarProps {
  userEmail?: string | null;
  userDisplayName?: string | null;
}

export function Topbar({ userEmail, userDisplayName }: TopbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const displayName = userDisplayName || userEmail?.split('@')[0] || 'Usuário';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex h-14 items-center justify-end border-b border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-950 px-5">
      {mounted && (
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all active:scale-95 outline-none"
          title="Alternar tema"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-orange-400" /> : <Moon className="h-4 w-4 text-orange-500" />}
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors outline-none">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-brand-500 text-white text-[10px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:block max-w-[140px] truncate font-medium">
            {displayName}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52 border-zinc-800 bg-zinc-900 shadow-xl"
        >
          <div className="px-2 py-2">
            <p className="text-sm font-medium text-zinc-100 truncate">
              {userDisplayName || displayName}
            </p>
            {userEmail && (
              <p className="text-xs text-zinc-500 truncate mt-0.5">{userEmail}</p>
            )}
          </div>
          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer text-zinc-400 hover:text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100 gap-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair da conta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
