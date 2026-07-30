-- 0002_seed_admin_user.sql
-- Creates the first admin account directly in auth.users, then links it to the
-- 'admin' role. Run AFTER 0001. Safe to re-run — it no-ops if the user exists.
--
-- SECURITY: this file contains a plaintext bootstrap password. Change the
-- password from the app (or the Supabase dashboard) after first sign-in, and do
-- not commit this file to a shared repo.

do $$
declare
  v_email    text := 'englishdreamsofficial@gmail.com';
  v_password text := 'Eng@12345';
  v_user_id  uuid;
begin
  select id into v_user_id from auth.users where email = v_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      -- GoTrue scans these into non-nullable strings; NULL here makes every
      -- login fail with "Database error querying schema". Must be ''.
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'English Dreams Admin'),
      now(),
      now(),
      '', '', '', '', '', '', '', ''
    );

    -- Required for email/password sign-in to resolve the identity.
    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      now(),
      now(),
      now()
    );
  end if;

  -- Profile row (the on_auth_user_created trigger normally handles this).
  insert into public.profiles (id, email, full_name)
  values (v_user_id, v_email, 'English Dreams Admin')
  on conflict (id) do nothing;

  -- Link the user to the 'admin' role via the relation table.
  insert into public.user_role_assignments (user_id, role_id)
  select v_user_id, r.id from public.user_roles r where r.name = 'admin'
  on conflict (user_id, role_id) do nothing;
end
$$;

-- Verify:
--   select p.email, r.name
--   from public.profiles p
--   join public.user_role_assignments a on a.user_id = p.id
--   join public.user_roles r on r.id = a.role_id;
