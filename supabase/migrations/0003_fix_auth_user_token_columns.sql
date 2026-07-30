-- 0003_fix_auth_user_token_columns.sql
-- Repairs users inserted directly into auth.users by 0002.
--
-- GoTrue scans these token columns into non-nullable strings. Supabase's own
-- signup path writes '' into them; a hand-written INSERT leaves them NULL,
-- and every password login then fails with:
--   500 unexpected_failure — "Database error querying schema"
--
-- Idempotent. Run in the Supabase SQL editor.

update auth.users
set
  confirmation_token           = coalesce(confirmation_token, ''),
  recovery_token               = coalesce(recovery_token, ''),
  email_change                 = coalesce(email_change, ''),
  email_change_token_new       = coalesce(email_change_token_new, ''),
  email_change_token_current   = coalesce(email_change_token_current, ''),
  phone_change                 = coalesce(phone_change, ''),
  phone_change_token           = coalesce(phone_change_token, ''),
  reauthentication_token       = coalesce(reauthentication_token, '')
where
  confirmation_token is null
  or recovery_token is null
  or email_change is null
  or email_change_token_new is null
  or email_change_token_current is null
  or phone_change is null
  or phone_change_token is null
  or reauthentication_token is null;
