'use client';

import { useState } from 'react';
import { Plus, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GroupCard } from './GroupCard';
import { GroupSheet } from './GroupSheet';

interface GroupData {
  id: string;
  name: string;
  marketplaces: string[];
  is_active: boolean;
  daily_limit: number;
  min_discount: number;
  min_price: number | null;
  max_price: number | null;
  min_sales: number;
  template_text: string | null;
  keywords: string[] | null;
  blocked_keywords: string[] | null;
  destinations_count: number;
  dispatched_today: number;
  automation_active: boolean;
  has_automation_rule: boolean;
  group_destinations: Array<{
    target_id: string;
    target_name: string | null;
    channel_type: string;
  }>;
}

export function GroupsClient({ groups, connectedMarketplaces, hasTelegramConnected }: { groups: GroupData[]; connectedMarketplaces: string[]; hasTelegramConnected: boolean }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupData | null>(null);

  function openCreate() {
    setEditingGroup(null);
    setSheetOpen(true);
  }

  function openEdit(group: GroupData) {
    setEditingGroup(group);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6 max-w-7xl md:px-2 md:py-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight">
            Grupos de Disparo
          </h1>
          <p className="text-sm text-zinc-400 mt-2">
            Configure regras de disparo, limites diários, automações e comissões.
          </p>
        </div>
        <Button
          onClick={openCreate}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shrink-0 h-10 px-5 rounded-xl shadow-[0_0_20px_-5px_rgba(99,102,241,0.4)] transition-all hover:shadow-[0_0_25px_0px_rgba(99,102,241,0.5)]"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo grupo
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-xl p-12 text-center shadow-xl overflow-hidden relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full blur-[100px] bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 opacity-40" />
          <div className="flex justify-center mb-6 relative z-10">
            <div className="rounded-2xl bg-indigo-500/10 p-5 ring-1 ring-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.15)]">
              <Layers className="h-10 w-10 text-indigo-400" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 relative z-10 tracking-tight">
            Nenhum grupo criado ainda
          </h2>
          <p className="text-sm text-zinc-400 max-w-sm mx-auto mb-8 relative z-10 leading-relaxed">
            Crie seu primeiro grupo de disparo para começar a pesquisar ofertas e enviá-las no automático.
          </p>
          <div className="relative z-10 text-center">
            <Button
              onClick={openCreate}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar o primeiro grupo
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} onEdit={() => openEdit(g)} />
          ))}
        </div>
      )}

      <GroupSheet
        connectedMarketplaces={connectedMarketplaces}
        hasTelegramConnected={hasTelegramConnected}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditingGroup(null);
        }}
        editGroup={
          editingGroup
            ? {
                id: editingGroup.id,
                name: editingGroup.name,
                marketplaces: editingGroup.marketplaces,
                min_discount: editingGroup.min_discount,
                min_price: editingGroup.min_price,
                max_price: editingGroup.max_price,
                min_sales: editingGroup.min_sales,
                daily_limit: editingGroup.daily_limit,
                template_text: editingGroup.template_text,
                keywords: editingGroup.keywords,
                blocked_keywords: editingGroup.blocked_keywords,
                destinations: editingGroup.group_destinations,
              }
            : undefined
        }
      />
    </div>
  );
}
