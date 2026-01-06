
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// SQL Setup instructions for User:
/*
-- Run this in Supabase SQL Editor to simple setup:

create table game_saves (
  user_id uuid references auth.users not null primary key,
  save_data jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table game_saves enable row level security;

create policy "Users can upsert their own save."
  on game_saves for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own save."
  on game_saves for update
  using ( auth.uid() = user_id );

create policy "Users can read their own save."
  on game_saves for select
  using ( auth.uid() = user_id );
*/
