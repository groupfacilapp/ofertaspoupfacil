'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlanFormSheet } from './PlanFormSheet';

export function NewPlanButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-zinc-100 text-zinc-900 hover:bg-white font-medium text-sm h-9 px-4"
      >
        <Plus className="h-4 w-4 mr-1.5" />
        Novo plano
      </Button>
      <PlanFormSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
