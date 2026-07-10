export const dynamic = 'force-dynamic';

import { adminListPlans } from './actions';
import { PlanRow } from './PlanRow';
import { PlanFormSheet } from './PlanFormSheet';
import { PlusIcon } from 'lucide-react';
import { NewPlanButton } from './NewPlanButton';

export default async function AdminPlansPage() {
  const plans = await adminListPlans();

  const activeCount = plans.filter((p) => p.ativo).length;
  const totalUsers = plans.reduce((acc, p) => acc + p.user_count, 0);

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Planos</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {activeCount} ativos · {plans.length} total · {totalUsers} usuários vinculados
          </p>
        </div>
        <NewPlanButton />
      </div>

      <div className="space-y-2">
        {plans.map((plan) => (
          <PlanRow key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  );
}
