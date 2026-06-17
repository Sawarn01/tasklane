-- Extend the notifications type check to allow 'chat_message'
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
    check (type in ('comment', 'mention', 'assigned', 'chat_message'));
