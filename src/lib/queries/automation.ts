import { supabaseAdmin } from '@/lib/supabase/admin';

export type Marketplace = 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'kabum' | 'temu' | 'shein';
export type RuleType = 'fetch' | 'dispatch';

export interface AutomationRule {
  id: string;
  user_id: string;
  marketplace: Marketplace;
  rule_type: RuleType;
  is_active: boolean;
  interval_minutes: number;
  start_hour: number;
  end_hour: number;
  target_group_ids: string[];
  last_run_at: string | null;
  products_found_today: number;
  products_found_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface UpsertAutomationRuleInput {
  marketplace: Marketplace;
  rule_type: RuleType;
  is_active?: boolean;
  interval_minutes?: number;
  start_hour?: number;
  end_hour?: number;
  target_group_ids?: string[];
}

// Fetches all automation rules for a user
export async function getAutomationRules(userId: string): Promise<AutomationRule[]> {
  const { data, error } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('user_id', userId)
    .order('marketplace')
    .order('rule_type');

  if (error) throw new Error(`getAutomationRules: ${error.message}`);

  return (data ?? []).map((row) => ({
    ...row,
    target_group_ids: row.target_group_ids ?? [],
  }));
}

// Upserts an automation rule (marketplace + rule_type are unique per user)
export async function upsertAutomationRule(
  userId: string,
  rule: UpsertAutomationRuleInput
): Promise<AutomationRule> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('automation_rules')
    .upsert(
      {
        user_id: userId,
        marketplace: rule.marketplace,
        rule_type: rule.rule_type,
        is_active: rule.is_active ?? false,
        interval_minutes: rule.interval_minutes ?? 60,
        start_hour: rule.start_hour ?? 8,
        end_hour: rule.end_hour ?? 22,
        target_group_ids: rule.target_group_ids ?? [],
        updated_at: now,
      },
      {
        onConflict: 'user_id,marketplace,rule_type',
      }
    )
    .select()
    .single();

  if (error) throw new Error(`upsertAutomationRule: ${error.message}`);

  return data;
}

// Toggles the is_active status of an automation rule
export async function toggleAutomationRule(
  userId: string,
  ruleId: string,
  isActive: boolean
): Promise<AutomationRule> {
  const { data, error } = await supabaseAdmin
    .from('automation_rules')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ruleId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(`toggleAutomationRule: ${error.message}`);

  return data;
}
