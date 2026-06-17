-- Enable Supabase Realtime for the messages table (and task_comments while we're here)
-- Without this, no postgres_changes events are delivered for these tables.
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table task_comments;
