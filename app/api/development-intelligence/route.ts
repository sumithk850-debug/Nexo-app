import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/requestAuth.server";
import { getDevelopmentIntelligenceAdmin } from "@/lib/developmentIntelligence.server";

export const runtime = "nodejs";

const MAX = {
  name: 120,
  title: 240,
  description: 4000,
  detail: 4000,
  knowledge: 12000,
  preference: 2000,
  release: 6000,
  report: 5000,
};

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, limit) : "";
}

function id(value: unknown) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : "";
}

function tags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => text(tag, 40))
    .filter(Boolean)
    .slice(0, 12);
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function verified(request: Request) {
  const identity = await requireVerifiedUser(request);
  return identity.response ? { response: identity.response } : { userId: identity.user.id };
}

export async function GET(request: Request) {
  const identity = await verified(request);
  if ("response" in identity) return identity.response;

  try {
    const admin = getDevelopmentIntelligenceAdmin();
    const userId = identity.userId;
    const [brains, tasks, preferences, knowledge, reports, releases, recipes] = await Promise.all([
      admin.from("project_brains").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
      admin.from("brain_tasks").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
      admin.from("response_preferences").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("knowledge_entries").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50),
      admin.from("regression_reports").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(12),
      admin.from("release_briefs").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(12),
      admin.from("automation_recipes").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(20),
    ]);
    const failure = [brains, tasks, preferences, knowledge, reports, releases, recipes].find((result) => result.error)?.error;
    if (failure) {
      console.error("Development Intelligence load failed", failure);
      return error("Unable to load your private workspace.", 500);
    }
    return NextResponse.json({
      brains: brains.data ?? [],
      tasks: tasks.data ?? [],
      preferences: preferences.data ?? null,
      knowledgeEntries: knowledge.data ?? [],
      regressionReports: reports.data ?? [],
      releaseBriefs: releases.data ?? [],
      recipes: recipes.data ?? [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Development Intelligence GET failed", cause);
    return error("Unable to load your private workspace.", 500);
  }
}

export async function POST(request: Request) {
  const identity = await verified(request);
  if ("response" in identity) return identity.response;

  try {
    const body = await request.json();
    const action = text(body?.action, 40);
    const admin = getDevelopmentIntelligenceAdmin();
    const userId = identity.userId;

    if (action === "brain") {
      const name = text(body.name, MAX.name);
      if (!name) return error("A Project Brain name is required.");
      const isActive = Boolean(body.is_active);
      if (isActive) await admin.from("project_brains").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
      const { data, error: insertError } = await admin.from("project_brains").insert({
        user_id: userId,
        name,
        description: text(body.description, MAX.description),
        conventions: text(body.conventions, MAX.description),
        goals: text(body.goals, MAX.description),
        is_active: isActive,
      }).select().single();
      if (insertError) return error("Unable to create Project Brain.", 500);
      return NextResponse.json({ item: data });
    }

    if (action === "task") {
      const title = text(body.title, MAX.title);
      const brainId = id(body.project_brain_id);
      if (!title) return error("A task title is required.");
      if (brainId) {
        const { data: brain } = await admin.from("project_brains").select("id").eq("id", brainId).eq("user_id", userId).maybeSingle();
        if (!brain) return error("The selected Project Brain is unavailable.", 404);
      }
      const status = ["planned", "in_progress", "blocked", "completed"].includes(body.status) ? body.status : "planned";
      const priority = ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium";
      const { data, error: insertError } = await admin.from("brain_tasks").insert({
        user_id: userId,
        project_brain_id: brainId || null,
        title,
        detail: text(body.detail, MAX.detail),
        status,
        priority,
      }).select().single();
      if (insertError) return error("Unable to create task.", 500);
      return NextResponse.json({ item: data });
    }

    if (action === "preference") {
      const detailLevel = ["concise", "balanced", "detailed"].includes(body.detail_level) ? body.detail_level : "balanced";
      const preferredLanguage = ["auto", "english", "sinhala"].includes(body.preferred_language) ? body.preferred_language : "auto";
      const { data, error: upsertError } = await admin.from("response_preferences").upsert({
        user_id: userId,
        instruction: text(body.instruction, MAX.preference),
        detail_level: detailLevel,
        preferred_language: preferredLanguage,
      }, { onConflict: "user_id" }).select().single();
      if (upsertError) return error("Unable to save preferences.", 500);
      return NextResponse.json({ item: data });
    }

    if (action === "knowledge") {
      const title = text(body.title, 180);
      const content = text(body.content, MAX.knowledge);
      if (!title || !content) return error("A knowledge note needs both a title and content.");
      const { data, error: insertError } = await admin.from("knowledge_entries").insert({ user_id: userId, title, content, tags: tags(body.tags) }).select().single();
      if (insertError) return error("Unable to save knowledge note.", 500);
      return NextResponse.json({ item: data });
    }

    if (action === "report") {
      const title = text(body.title, 180);
      const overallStatus = ["ready", "attention", "blocked"].includes(body.overall_status) ? body.overall_status : "attention";
      if (!title) return error("A report title is required.");
      const checks = Array.isArray(body.checks) ? body.checks.slice(0, 16) : [];
      const { data, error: insertError } = await admin.from("regression_reports").insert({
        user_id: userId, title, overall_status: overallStatus, summary: text(body.summary, MAX.report), checks,
      }).select().single();
      if (insertError) return error("Unable to save regression report.", 500);
      return NextResponse.json({ item: data });
    }

    if (action === "release") {
      const title = text(body.title, 180);
      if (!title) return error("A release title is required.");
      const status = body.status === "ready" ? "ready" : "draft";
      const checklist = Array.isArray(body.checklist) ? body.checklist.slice(0, 20) : [];
      const { data, error: insertError } = await admin.from("release_briefs").insert({
        user_id: userId, title, version: text(body.version, 80), summary: text(body.summary, MAX.release), checklist, status,
      }).select().single();
      if (insertError) return error("Unable to create release brief.", 500);
      return NextResponse.json({ item: data });
    }

    if (action === "recipe_preview") {
      const recipeId = id(body.recipe_id);
      if (!recipeId) return error("A valid recipe is required.");
      const { data: recipe, error: recipeError } = await admin
        .from("automation_recipes")
        .select("id, name, description, recipe_type, enabled, approval_required")
        .eq("id", recipeId)
        .eq("user_id", userId)
        .maybeSingle();
      if (recipeError || !recipe) return error("The selected recipe is unavailable.", 404);

      const stepsByType: Record<string, string[]> = {
        review_repository: [
          "Confirm the connected repository and selected branch.",
          "Read repository structure and recent non-sensitive metadata.",
          "Summarize likely review areas and stop before any file change.",
        ],
        audit_schema: [
          "Confirm the connected database workspace.",
          "Prepare a read-only schema and constraint review.",
          "List potential follow-up changes, each requiring a separate approval.",
        ],
        prepare_release: [
          "Collect the chosen release scope and completed tasks.",
          "Prepare a draft release summary and pre-release checklist.",
          "Stop before commits, deployment, promotion, or publication.",
        ],
        check_deployment: [
          "Confirm the connected deployment workspace.",
          "Prepare a read-only deployment-health check.",
          "List safe follow-up recommendations without changing a deployment.",
        ],
      };

      return NextResponse.json({
        preview: {
          recipeId: recipe.id,
          name: recipe.name,
          description: recipe.description,
          recipeType: recipe.recipe_type,
          enabled: recipe.enabled,
          steps: stepsByType[recipe.recipe_type] ?? stepsByType.review_repository,
          mutationPolicy: "No external write can run from a recipe preview. Any repository, database, or deployment mutation requires a separate approval card.",
        },
      }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "recipe") {
      const name = text(body.name, MAX.name);
      const recipeType = ["review_repository", "audit_schema", "prepare_release", "check_deployment"].includes(body.recipe_type)
        ? body.recipe_type : "review_repository";
      if (!name) return error("A recipe name is required.");
      const { data, error: insertError } = await admin.from("automation_recipes").insert({
        user_id: userId, name, description: text(body.description, 2000), recipe_type: recipeType,
        enabled: false, approval_required: true,
      }).select().single();
      if (insertError) return error("Unable to create safe recipe.", 500);
      return NextResponse.json({ item: data });
    }

    return error("Unknown workspace action.");
  } catch (cause) {
    console.error("Development Intelligence POST failed", cause);
    return error("Unable to save workspace data.", 500);
  }
}

export async function PATCH(request: Request) {
  const identity = await verified(request);
  if ("response" in identity) return identity.response;

  try {
    const body = await request.json();
    const resource = text(body?.resource, 40);
    const recordId = id(body?.id);
    if (!recordId) return error("A valid workspace record is required.");
    const admin = getDevelopmentIntelligenceAdmin();
    const userId = identity.userId;

    if (resource === "brain") {
      const patch: Record<string, unknown> = {};
      if (typeof body.name === "string") patch.name = text(body.name, MAX.name);
      if (typeof body.description === "string") patch.description = text(body.description, MAX.description);
      if (typeof body.conventions === "string") patch.conventions = text(body.conventions, MAX.description);
      if (typeof body.goals === "string") patch.goals = text(body.goals, MAX.description);
      if (typeof body.is_active === "boolean") {
        if (body.is_active) await admin.from("project_brains").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
        patch.is_active = body.is_active;
      }
      const { data, error: updateError } = await admin.from("project_brains").update(patch).eq("id", recordId).eq("user_id", userId).select().maybeSingle();
      if (updateError || !data) return error("Unable to update Project Brain.", 404);
      return NextResponse.json({ item: data });
    }

    if (resource === "task") {
      const patch: Record<string, unknown> = {};
      if (typeof body.title === "string") patch.title = text(body.title, MAX.title);
      if (typeof body.detail === "string") patch.detail = text(body.detail, MAX.detail);
      if (["planned", "in_progress", "blocked", "completed"].includes(body.status)) patch.status = body.status;
      if (["low", "medium", "high"].includes(body.priority)) patch.priority = body.priority;
      const { data, error: updateError } = await admin.from("brain_tasks").update(patch).eq("id", recordId).eq("user_id", userId).select().maybeSingle();
      if (updateError || !data) return error("Unable to update task.", 404);
      return NextResponse.json({ item: data });
    }

    if (resource === "recipe") {
      const patch: Record<string, unknown> = {};
      if (typeof body.name === "string") patch.name = text(body.name, MAX.name);
      if (typeof body.description === "string") patch.description = text(body.description, 2000);
      // Recipes may be enabled, but no endpoint can execute an external write.
      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      const { data, error: updateError } = await admin.from("automation_recipes").update(patch).eq("id", recordId).eq("user_id", userId).select().maybeSingle();
      if (updateError || !data) return error("Unable to update safe recipe.", 404);
      return NextResponse.json({ item: data });
    }

    return error("Unknown workspace resource.");
  } catch (cause) {
    console.error("Development Intelligence PATCH failed", cause);
    return error("Unable to update workspace data.", 500);
  }
}

export async function DELETE(request: Request) {
  const identity = await verified(request);
  if ("response" in identity) return identity.response;

  try {
    const { searchParams } = new URL(request.url);
    const resource = text(searchParams.get("resource"), 40);
    const recordId = id(searchParams.get("id"));
    const table = ({ brain: "project_brains", task: "brain_tasks", knowledge: "knowledge_entries", report: "regression_reports", release: "release_briefs", recipe: "automation_recipes" } as const)[resource as "brain"];
    if (!recordId || !table) return error("A valid workspace item is required.");
    const { error: deleteError } = await getDevelopmentIntelligenceAdmin().from(table).delete().eq("id", recordId).eq("user_id", identity.userId);
    if (deleteError) return error("Unable to delete workspace item.", 500);
    return NextResponse.json({ success: true });
  } catch (cause) {
    console.error("Development Intelligence DELETE failed", cause);
    return error("Unable to delete workspace item.", 500);
  }
}
