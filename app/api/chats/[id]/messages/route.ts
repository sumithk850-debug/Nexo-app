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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, model_id, created_at")
    .eq("chat_id", id)
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
      chat_id: id,
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
    .eq("id", id);

  return new Response(JSON.stringify({ message: data }), { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("id");

  if (!messageId) {
    return new Response(JSON.stringify({ error: "Missing message id" }), {
      status: 400,
    });
  }

  const supabase = getSupabase();

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("chat_id", id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  await supabase
    .from("chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
