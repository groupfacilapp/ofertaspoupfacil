'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { upsertAutomationRule, toggleAutomationRule, type Marketplace, type RuleType } from '@/lib/queries/automation';

export interface SaveAutomationRuleInput {
  marketplace: string;
  rule_type: 'fetch' | 'dispatch';
  is_active: boolean;
  interval_minutes: number;
  start_hour?: number;
  end_hour?: number;
  target_group_ids?: string[];
}

export async function saveAutomationRule(
  input: SaveAutomationRuleInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Nao autenticado' };

    await upsertAutomationRule(user.id, {
      marketplace: input.marketplace as Marketplace,
      rule_type: input.rule_type as RuleType,
      is_active: input.is_active,
      interval_minutes: input.interval_minutes,
      start_hour: input.start_hour ?? 8,
      end_hour: input.end_hour ?? 22,
      target_group_ids: input.target_group_ids ?? [],
    });

    revalidatePath('/automacoes');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { success: false, error: message };
  }
}

export async function toggleRule(
  ruleId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, error: 'Nao autenticado' };

    await toggleAutomationRule(user.id, ruleId, isActive);

    revalidatePath('/automacoes');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { success: false, error: message };
  }
}
