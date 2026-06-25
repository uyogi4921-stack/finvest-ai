-- Curated lesson content for RAG. Team-editable (the model reads from here,
-- not from anything baked into the prompt). Embeddings are gte-small (384-dim).

create extension if not exists vector;

create table if not exists lesson_chunks (
  id          bigint generated always as identity primary key,
  lesson_id   text not null,
  module      text not null default 'market-basics',   -- routing namespace (Step 4)
  topic       text not null,
  level       text not null default 'all',              -- beginner | intermediate | advanced | all
  content     text not null,
  embedding   vector(384),
  updated_at  timestamptz not null default now()
);

-- Approximate-NN index for cosine distance.
create index if not exists lesson_chunks_embedding_idx
  on lesson_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index if not exists lesson_chunks_module_idx on lesson_chunks (module, level);

-- Retrieval RPC: cosine similarity, optional module/level filter.
create or replace function match_lesson_chunks(
  query_embedding vector(384),
  match_count int default 5,
  filter_module text default null,
  filter_level text default null
)
returns table (
  lesson_id text,
  module text,
  topic text,
  level text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    lesson_id, module, topic, level, content,
    1 - (embedding <=> query_embedding) as similarity
  from lesson_chunks
  where embedding is not null
    and (filter_module is null or module = filter_module)
    and (filter_level is null or level = filter_level or level = 'all')
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- learner_state table backing the user_state() tool.
create table if not exists learner_state (
  user_id               text primary key,
  name                  text,
  level                 text default 'beginner',
  goals                 text[],
  risk_tolerance        text,
  current_lesson_id     text,
  lessons_completed     int default 0,
  recent_quiz_score_pct int,
  updated_at            timestamptz not null default now()
);
