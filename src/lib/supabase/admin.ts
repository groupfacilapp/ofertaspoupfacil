import { createClient } from '@supabase/supabase-js';

// Admin client with service_role key — bypasses RLS.
// ONLY use in server-only code (workers, admin scripts).
// NEVER import in client-facing code.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
