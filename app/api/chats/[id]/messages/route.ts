import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, model_id, created_at")
    .eq("chat_id", params.id)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ messages: data }), {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { role, content, modelId } = body;

  if (!role || content === undefined) {
    return new Response(JSON.stringify({ error: "Missing role or content" }), {
      status: 400,
    });
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("messages")
    .insert({
      chat_id: params.id,
      role,
      content,
      model_id: modelId || null,
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  await supabase
    .from("chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", params.id);

  return new Response(JSON.stringify({ message: data }), { status: 201 });
}
