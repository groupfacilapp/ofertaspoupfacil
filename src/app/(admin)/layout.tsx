import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { BRAND } from '@/config/brand';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // SECURITY: use app_metadata (service-role only) NOT user_metadata (user-editable)
  const isAdmin = user.app_metadata?.is_admin === true;
  if (!isAdmin) redirect('/');

  return (
    <div className="flex h-screen bg-zinc-950">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-zinc-800/60 bg-zinc-950 px-5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/20">
              ADMIN
            </span>
            <span className="text-xs text-zinc-600">{BRAND.name} Platform</span>
          </div>
          <span className="text-xs text-zinc-600">{user.email}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
