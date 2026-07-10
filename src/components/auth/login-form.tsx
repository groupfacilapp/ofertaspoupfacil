'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { login } from '@/app/(auth)/login/actions';

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white">Bem-vindo de volta</h1>
        <p className="text-sm text-zinc-500 mt-1">Entre na sua conta para continuar</p>
      </div>

      <form action={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="seu@email.com"
            required
            disabled={isPending}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition-all disabled:opacity-50"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Senha
            </label>
            <Link href="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Esqueceu a senha?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPass ? 'text' : 'password'}
              placeholder="Sua senha"
              required
              minLength={6}
              disabled={isPending}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition-all disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
              tabIndex={-1}
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Entrando...</> : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Não tem conta?{' '}
        <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
          Criar conta grátis
        </Link>
      </p>
    </div>
  );
}
