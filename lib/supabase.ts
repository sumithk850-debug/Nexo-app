import { createClient } from "@supabase/supabase-js";

// These are public (client-exposed) values. The env vars take precedence when
// present; the fallbacks keep the app working in every environment.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://apvqebqigqirmvemhnmz.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwdnFlYnFpZ3Fpcm12ZW1obm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NTEyOTksImV4cCI6MjA5OTQyNzI5OX0.J8PvV0dRQmgRZMptcUB0lLlZPKJjpglZAl0tbCnN0bs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface DbChat {
  id: string;
  session_id: string;
  title: string;
  model_id: string;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  model_id: string | null;
  created_at: string;
}
