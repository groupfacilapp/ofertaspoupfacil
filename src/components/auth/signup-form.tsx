'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { signUp } from '@/app/(auth)/signup/actions';
import { BRAND } from '@/config/brand';

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await signUp(formData);
      if (result?.error) setError(result.error);
      if (result?.success) setSuccess(result.success);
    });
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-500/15 p-4 border border-emerald-500/20">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Verifique seu email</h2>
          <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{success}</p>
        </div>
        <Link
          href="/login"
          className="inline-block text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white">Criar conta grátis</h1>
        <p className="text-sm text-zinc-500 mt-1">Comece a usar o {BRAND.name} hoje</p>
      </div>

      <form action={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="display_name" className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Seu nome
          </label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            placeholder="Como quer ser chamado?"
            disabled={isPending}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition-all disabled:opacity-50"
          />
        </div>

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
          <label htmlFor="password" className="block text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Senha
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPass ? 'text' : 'password'}
              placeholder="Mínimo 6 caracteres"
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
          {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Criando conta...</> : 'Criar conta grátis'}
        </button>

        <p className="text-center text-[10px] text-zinc-600 leading-relaxed">
          Ao criar sua conta você concorda com os nossos{' '}
          <span className="text-zinc-500">Termos de Uso</span> e{' '}
          <span className="text-zinc-500">Política de Privacidade</span>.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        Já tem conta?{' '}
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
          Entrar
        </Link>
      </p>
    </div>
  );
}
