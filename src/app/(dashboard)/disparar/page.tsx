export const dynamic = 'force-dynamic';
import { getActiveGroupsForDispatch } from './actions';
import { ManualDispatchClient } from './components/ManualDispatchClient';

export default async function DispararPage() {
  const groups = await getActiveGroupsForDispatch();

  return <ManualDispatchClient groups={groups} />;
}
