'use client';

import { useActionState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { updateProfile } from './actions';

export function ProfileForm({ defaultName, email }: { defaultName: string; email: string }) {
  const [state, action, isPending] = useActionState(updateProfile, null);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Nome de exibição</label>
        <input
          name="display_name"
          defaultValue={defaultName}
          placeholder="Seu nome"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition-all"
        />
      </div>
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</label>
        <input
          value={email}
          disabled
          className="w-full rounded-lg border border-zinc-800/40 bg-zinc-800/20 px-4 py-2.5 text-sm text-zinc-500 cursor-not-allowed"
        />
        <p className="text-[10px] text-zinc-700">O email não pode ser alterado por aqui.</p>
      </div>

      {state && (
        <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${state.ok ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'}`}>
          {state.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {state.ok ? 'Perfil atualizado!' : state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
      >
        {isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando...</> : 'Salvar'}
      </button>
    </form>
  );
}
