UPDATE auth.users 
SET raw_app_meta_data = COALESCE(
  jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb), 
    '{is_admin}', 
    'true'::jsonb
  ),
  '{"is_admin": true}'::jsonb
) 
WHERE email = 'email@exemplo.com';