export const dynamic = 'force-dynamic';
import { adminListUsersWithPlans, adminGetAllPlans } from './actions';
import { UserPlanRow } from './UserPlanRow';
import { Users, Crown, UserCheck } from 'lucide-react';

export default async function AdminUsersPage() {
  const [users, plans] = await Promise.all([
    adminListUsersWithPlans(),
    adminGetAllPlans(),
  ]);

  const proCount = users.filter((u) => u.plan === 'profissional' || u.plan === 'premium' || u.plan === 'basico').length;
  const freeCount = users.filter((u) => u.plan === 'trial').length;

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white">Usuários</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Gerencie planos e acessos. Planos são controlados manualmente até a integração com gateway de pagamento.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4 flex items-center gap-3">
          <div className="rounded-lg bg-zinc-800/80 p-2 shrink-0">
            <Users className="h-4 w-4 text-zinc-400" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Total</p>
            <p className="text-2xl font-semibold text-white leading-tight">{users.length}</p>
          </div>
        </div>
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex items-center gap-3">
          <div className="rounded-lg bg-indigo-500/10 p-2 shrink-0">
            <Crown className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Pro</p>
            <p className="text-2xl font-semibold text-indigo-400 leading-tight">{proCount}</p>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4 flex items-center gap-3">
          <div className="rounded-lg bg-zinc-800/80 p-2 shrink-0">
            <UserCheck className="h-4 w-4 text-zinc-500" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Free</p>
            <p className="text-2xl font-semibold text-zinc-400 leading-tight">{freeCount}</p>
          </div>
        </div>
      </div>

      {/* User list */}
      <div className="space-y-2">
        {users.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-8 text-center">
            <p className="text-sm text-zinc-500">Nenhum usuário cadastrado</p>
          </div>
        ) : (
          users.map((user) => <UserPlanRow key={user.id} user={user} plans={plans} />)
        )}
      </div>

      {/* How to make admin */}
      <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/20 p-4">
        <p className="text-xs text-zinc-500 font-medium mb-2">Como tornar um usuário admin:</p>
        <pre className="text-xs text-zinc-600 font-mono bg-zinc-800/60 rounded p-3 overflow-x-auto whitespace-pre">
{`-- Execute no Supabase SQL Editor:
UPDATE auth.users
SET app_metadata = app_metadata || '{"is_admin": true}'
WHERE email = 'seu@email.com';`}
        </pre>
      </div>

    </div>
  );
}
