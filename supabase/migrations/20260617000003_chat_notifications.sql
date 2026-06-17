-- Enable realtime delivery for notifications so the bell badge updates instantly
alter publication supabase_realtime add table notifications;

-- ── Trigger function ──────────────────────────────────────────────────────────
-- Fires after every new message and creates one notification per project member
-- (excluding the sender so you never notify yourself).
create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer   -- runs as the owner so it can bypass RLS on insert
set search_path = public
as $$
declare
  v_sender_name  text;
  v_project_name text;
begin
  select full_name into v_sender_name  from public.profiles where id = NEW.user_id;
  select name      into v_project_name from public.projects where id = NEW.project_id;

  insert into public.notifications (user_id, project_id, actor_id, type, message)
  select
    pm.user_id,
    NEW.project_id,
    NEW.user_id,
    'chat_message',
    coalesce(v_sender_name, 'Someone') || ' sent a message in ' || coalesce(v_project_name, 'a project')
  from public.project_members pm
  where pm.project_id = NEW.project_id
    and pm.user_id <> NEW.user_id;

  return NEW;
end;
$$;

-- ── Trigger ───────────────────────────────────────────────────────────────────
drop trigger if exists on_chat_message_created on public.messages;
create trigger on_chat_message_created
  after insert on public.messages
  for each row
  execute function public.notify_chat_message();
