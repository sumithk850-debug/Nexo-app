import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface CommitFile {
  filePath: string;
  content: string;
  type: "editing" | "creating" | "deleting";
}

// POST /api/github/commit — apply approved file changes to the user's
// selected repo via the GitHub Contents API, one file at a time.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, files, commitMessage } = body as {
    userId: string;
    files: CommitFile[];
    commitMessage: string;
  };

  if (!userId || !files || files.length === 0) {
    return new Response(JSON.stringify({ error: "Missing userId or files" }), { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: connection } = await supabase
    .from("github_connections")
    .select("access_token, selected_repo")
    .eq("user_id", userId)
    .maybeSingle();

  if (!connection || !connection.selected_repo) {
    return new Response(
      JSON.stringify({ error: "No GitHub repo selected. Choose one in Settings first." }),
      { status: 400 }
    );
  }

  const token = connection.access_token;
  const repo = connection.selected_repo; // "owner/repo"
  const results: { filePath: string; success: boolean; error?: string }[] = [];

  for (const file of files) {
    try {
      const contentsUrl = `https://api.github.com/repos/${repo}/contents/${file.filePath}`;

      // Need the current file's sha for updates/deletes; omit for new files.
      let sha: string | undefined;
      if (file.type !== "creating") {
        const existingRes = await fetch(contentsUrl, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        if (existingRes.ok) {
          const existing = await existingRes.json();
          sha = existing.sha;
        }
      }

      if (file.type === "deleting") {
        if (!sha) {
          results.push({ filePath: file.filePath, success: false, error: "File not found or cannot be accessed" });
          continue;
        }
        const delRes = await fetch(contentsUrl, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: commitMessage || `chore: delete ${file.filePath} via NEXO Craft V3`,
            sha,
          }),
        });
        if (!delRes.ok) {
          const errBody = await delRes.text().catch(() => "");
          results.push({ filePath: file.filePath, success: false, error: errBody.slice(0, 200) });
        } else {
          results.push({ filePath: file.filePath, success: true });
        }
        continue;
      }

      const base64Content = Buffer.from(file.content, "utf-8").toString("base64");
      const putRes = await fetch(contentsUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: commitMessage || `${file.type === "creating" ? "feat" : "refactor"}: update ${file.filePath} via NEXO Craft V3`,
          content: base64Content,
          sha,
        }),
      });

      if (!putRes.ok) {
        const errBody = await putRes.text().catch(() => "");
        results.push({ filePath: file.filePath, success: false, error: errBody.slice(0, 200) });
      } else {
        results.push({ filePath: file.filePath, success: true });
      }
    } catch (err) {
      results.push({ filePath: file.filePath, success: false, error: String(err) });
    }
  }

  const allSucceeded = results.every((r) => r.success);
  return new Response(JSON.stringify({ success: allSucceeded, results }), {
    status: allSucceeded ? 200 : 207,
  });
                                 }
