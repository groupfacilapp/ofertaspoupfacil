'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, ArrowRight, Zap } from 'lucide-react';
import { LoginForm } from '@/components/auth/login-form';
import { BRAND } from '@/config/brand';

type Mode = 'entrar' | null;

interface Props {
  defaultMode?: Mode;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerAsLink?: boolean;
}

export function EntrarModal({
  triggerLabel = 'Entrar',
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      {/* ── Modal backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal card */}
          <div
            className="relative z-10 w-full max-w-[420px] bg-white rounded-2xl shadow-2xl shadow-zinc-900/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-7 pb-0">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 shadow-sm shadow-brand-500/30">
                  <Zap className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-sm font-bold tracking-tight">
                  <span className="text-brand-500">{BRAND.namePart1}</span>
                  <span className="text-zinc-900">{BRAND.namePart2}</span>
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form body */}
            <div className="px-7 py-6">
              <LoginForm />
            </div>

            {/* Footer */}
            <div className="px-7 pb-7 pt-0">
              <div className="border-t border-zinc-100 pt-5 flex items-center justify-center gap-2">
                <span className="text-sm text-zinc-500">Não tem conta?</span>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-1 text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors"
                >
                  Criar conta grátis <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
