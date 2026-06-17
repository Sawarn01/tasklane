-- Add missing RLS policies for the invites table.
-- The table was created without an INSERT policy, so any insert from
-- the client was blocked by the default-deny RLS behaviour.

-- Any authenticated org member can create an invite for their org.
drop policy if exists "invites: insert" on public.invites;
create policy "invites: insert"
  on public.invites for insert
  with check (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

-- Org members can read invites for their org (needed to show/copy the link).
drop policy if exists "invites: select" on public.invites;
create policy "invites: select"
  on public.invites for select
  using (
    created_by = auth.uid()
    or org_id in (
      select org_id from public.org_members where user_id = auth.uid()
    )
  );

-- Org members can delete invites they created.
drop policy if exists "invites: delete" on public.invites;
create policy "invites: delete"
  on public.invites for delete
  using (created_by = auth.uid());

grant select, insert, delete on public.invites to authenticated;
