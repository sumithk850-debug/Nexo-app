-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table to store document embeddings for long term memory
CREATE TABLE IF NOT EXISTS memory_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  content text NOT NULL,
  embedding vector(1536), -- Adjust dimensions depending on the model
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create a function to match similarities
CREATE OR REPLACE FUNCTION match_memories (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    memory_embeddings.id,
    memory_embeddings.content,
    1 - (memory_embeddings.embedding <=> query_embedding) AS similarity
  FROM memory_embeddings
  WHERE memory_embeddings.user_id = p_user_id
    AND 1 - (memory_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
