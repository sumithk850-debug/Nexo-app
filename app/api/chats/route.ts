import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET /api/chats?sessionId=xxx — list all chats for a session
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing sessionId" }), {
      status: 400,
    });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ chats: data }), { status: 200 });
}

// POST /api/chats — create a new chat
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, title, modelId } = body;

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing sessionId" }), {
      status: 400,
    });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("chats")
    .insert({
      session_id: sessionId,
      title: title || "New chat",
      model_id: modelId || "nexio-1.1",
    })
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ chat: data }), { status: 201 });
}

// DELETE /api/chats?id=xxx — delete a chat
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
    });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("chats").delete().eq("id", id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
