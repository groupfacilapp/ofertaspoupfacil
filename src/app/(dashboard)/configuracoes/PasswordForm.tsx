'use client';

import { useActionState, useState } from 'react';
import { Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { updatePassword } from './actions';

export function PasswordForm() {
  const [state, action, isPending] = useActionState(updatePassword, null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Nova senha</label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-4 py-2.5 pr-10 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Confirmar senha</label>
        <div className="relative">
          <input
            name="confirm"
            type={showConfirm ? 'text' : 'password'}
            placeholder="••••••••"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 px-4 py-2.5 pr-10 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {state && (
        <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${state.ok ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'}`}>
          {state.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {state.ok ? 'Senha alterada com sucesso!' : state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
      >
        {isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando...</> : 'Alterar senha'}
      </button>
    </form>
  );
}
