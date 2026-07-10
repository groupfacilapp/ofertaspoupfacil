'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirm_password') as string;

  if (!password || !confirmPassword) {
    return { error: 'Todos os campos sao obrigatorios.' };
  }

  if (password.length < 6) {
    return { error: 'A senha deve ter no minimo 6 caracteres.' };
  }

  if (password !== confirmPassword) {
    return { error: 'As senhas nao coincidem.' };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/');
}
