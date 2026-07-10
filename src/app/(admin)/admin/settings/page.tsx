export const dynamic = 'force-dynamic';
import { SettingsForm } from './SettingsForm';
import { getAdminSettingsForDisplay } from './actions';

export default async function AdminSettingsPage() {
  // Uses getAdminSettingsForDisplay which decrypts sensitive values before returning
  const settingsMap = await getAdminSettingsForDisplay();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-white">Configurações da Plataforma</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Configure a integração com a Evolution API e limites do sistema.
        </p>
      </div>
      <SettingsForm settings={settingsMap} />
    </div>
  );
}
