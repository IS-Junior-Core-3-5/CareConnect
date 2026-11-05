-- AI chat history for the CareConnect assistant (recommend-providers Edge Function, mode "chat").
-- Each parent only sees, adds and clears their own messages.
create table if not exists public.ai_chat_messages (
  id          bigint generated always as identity primary key,
  parent_id   text not null references public.parents(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null check (char_length(content) between 1 and 4000),
  model       text,
  created_at  timestamptz not null default now()
);
create index if not exists ai_chat_messages_parent_idx on public.ai_chat_messages (parent_id, created_at);

alter table public.ai_chat_messages enable row level security;
create policy "own chat read"   on public.ai_chat_messages for select to authenticated using (parent_id = my_parent_id());
create policy "own chat insert" on public.ai_chat_messages for insert to authenticated with check (parent_id = my_parent_id());
create policy "own chat delete" on public.ai_chat_messages for delete to authenticated using (parent_id = my_parent_id());
