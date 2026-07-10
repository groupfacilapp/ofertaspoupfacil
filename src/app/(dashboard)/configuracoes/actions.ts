'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function updateProfile(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const displayName = (formData.get('display_name') as string)?.trim();

  if (!displayName) return { ok: false, error: 'Nome não pode ser vazio.' };

  const { error } = await supabase.auth.updateUser({
    data: { display_name: displayName },
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/configuracoes');
  revalidatePath('/');
  return { ok: true };
}

export async function updatePassword(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const password = formData.get('password') as string;
  const confirm = formData.get('confirm') as string;

  if (!password || password.length < 6) return { ok: false, error: 'Senha deve ter no mínimo 6 caracteres.' };
  if (password !== confirm) return { ok: false, error: 'As senhas não conferem.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
