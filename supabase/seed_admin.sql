-- Creates one real login account for the PCG | MindRift Workflow Portal.
--
-- EDIT the three values below, then paste this whole file into the
-- Supabase SQL Editor (dashboard → SQL Editor → New query → Run).
-- Run it once per person you want to be able to sign in.

do $$
declare
  new_user_id uuid := gen_random_uuid();
  user_email text := 'invoices.admin@pcg.com';   -- <-- change this
  user_password text := 'password123';                        -- <-- change this
  user_name text := 'Admin';                      -- <-- change this
  user_role text := 'Administrator';                           -- Administrator | AP Manager | AP Clerk | Approver | Auditor | Viewer
  user_dept text := 'Finance';                                 -- <-- change this
begin
  -- 1. the actual login (email + password)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated', user_email,
    crypt(user_password, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '',
    '', '', '',
    '', ''
  );

  -- 2. required so email/password sign-in actually works
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_user_id, new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', user_email),
    'email', now(), now(), now()
  );

  -- 3. this app's own profile row (name/role/department shown in the UI)
  insert into public.invoice_app_users (id, name, email, role, dept)
  values (new_user_id, user_name, user_email, user_role, user_dept);
end $$;
