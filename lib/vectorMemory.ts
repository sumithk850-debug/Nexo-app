import { supabase } from "./supabase";

export async function addMemory(userId: string, content: string, embedding: number[]) {
  const { data, error } = await supabase
    .from('memory_embeddings')
    .insert([{ user_id: userId, content, embedding }]);
  if (error) throw error;
  return data;
}

export async function searchMemories(userId: string, queryEmbedding: number[], threshold = 0.7, limit = 5) {
  const { data, error } = await supabase.rpc('match_memories', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: limit,
    p_user_id: userId
  });
  if (error) throw error;
  return data;
}
