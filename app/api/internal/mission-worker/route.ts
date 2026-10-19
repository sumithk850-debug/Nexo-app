import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin.server";

export const runtime = "nodejs";
export const maxDuration = 55;

type MissionStep = { title: string; instruction: string };
type StepResult = { title: string; output: string; completedAt: string };
type MissionJob = {
  id: string;
  title: string;
  prompt: string;
  status: string;
  plan: MissionStep[];
  current_step: number;
  step_results: StepResult[];
  attempt_count: number;
  max_attempts: number;
  lease_token: string;
  cancel_requested: boolean;
};

const MODEL_CANDIDATES = [
  "openrouter/free",
  "google/gemma-4-31b-it:free",
  "openai/gpt-oss-20b:free",
];
const MAX_OUTPUT_CHARS = 9000;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function extractMessageContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
      return "";
    }).join("\n").trim();
  }
  return "";
}

async function callModel(system: string, user: string, maxTokens = 1400): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("The server-side AI provider is not configured.");

  let lastFailure = "No configured model returned a response.";
  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://nexo-app-hasith-s-projects3.vercel.app",
          "X-Title": "KYVORIX AI Mission Worker",
        },
        body: JSON.stringify({
          model,
          temperature: 0.25,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(16_000),
        cache: "no-store",
      });

      if (!response.ok) {
        lastFailure = `AI provider returned HTTP ${response.status} for model ${model}.`;
        continue;
      }
      const payload: unknown = await response.json();
      const content = extractMessageContent(payload);
      if (content) return content;
      lastFailure = `AI provider returned an empty response for model ${model}.`;
    } catch (error) {
      lastFailure = error instanceof Error && error.name === "TimeoutError"
        ? `AI model ${model} timed out.`
        : `AI model ${model} could not be reached.`;
    }
  }
  throw new Error(lastFailure);
}

function parsePlan(raw: string): MissionStep[] {
  const stripped = raw.replace(/^\uFEFF/, "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("The mission planner did not return a valid step plan.");
  const parsed: unknown = JSON.parse(stripped.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("The mission plan must be a list of steps.");

  const steps = parsed
    .filter((step): step is Record<string, unknown> => Boolean(step) && typeof step === "object")
    .map((step) => ({
      title: typeof step.title === "string" ? step.title.trim().slice(0, 100) : "",
      instruction: typeof step.instruction === "string" ? step.instruction.trim().slice(0, 1800) : "",
    }))
    .filter((step) => step.title.length > 0 && step.instruction.length > 0)
    .slice(0, 5);

  if (steps.length < 2) throw new Error("The mission planner returned too few valid steps.");
  if (!/verif|review|quality|check|validate|audit/i.test(steps[steps.length - 1].title)) {
    if (steps.length === 5) steps.pop();
    steps.push({
      title: "Quality review and verification",
      instruction: "Review the previous outputs against the original request. Identify gaps, contradictions, unsupported claims, and missing deliverables. Produce a clear final quality review and correct issues that can be corrected from the provided context. Never claim that external actions, tests, deployments, or live research occurred unless evidence is present in the supplied context.",
    });
  }
  return steps;
}

function compileResult(results: StepResult[]): string {
  const joined = results.map((item, index) => `## ${index + 1}. ${item.title}\n\n${item.output}`).join("\n\n");
  return joined.length > 48_000 ? `${joined.slice(0, 47_500)}\n\n[Output shortened to fit the mission result limit.]` : joined;
}

async function processClaimedJob(job: MissionJob) {
  const admin = getSupabaseAdmin();

  if (!Array.isArray(job.plan) || job.plan.length === 0) {
    const rawPlan = await callModel(
      "You are KYVORIX Mission Planner. Convert the user's request into a safe, practical, self-contained work plan. You do not have live browsing, repository access, shell access, or external write tools in this worker. Never plan steps that pretend those tools exist. The plan must include a final quality review step. Return only a JSON array of 3 to 5 objects, each with string keys title and instruction. Keep instructions concise and make each step produce a useful deliverable.",
      `Mission title: ${job.title}\n\nUser request:\n${job.prompt}\n\nReturn only the JSON array.`,
      1000
    );
    const plan = parsePlan(rawPlan);
    const { data, error } = await admin
      .from("mission_jobs")
      .update({
        plan,
        current_step: 0,
        status: "queued",
        attempt_count: 0,
        last_error: null,
        lease_token: null,
        lease_expires_at: null,
        next_run_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("lease_token", job.lease_token)
      .eq("status", "running")
      .eq("cancel_requested", false)
      .select("id")
      .maybeSingle();

    if (error) throw new Error("Could not save the mission plan.");
    if (!data) {
      await admin.from("mission_jobs").update({
        status: "cancelled",
        lease_token: null,
        lease_expires_at: null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", job.id).eq("lease_token", job.lease_token).eq("cancel_requested", true);
      return { processed: true, outcome: "cancelled" };
    }
    return { processed: true, outcome: "planned", stepCount: plan.length };
  }

  if (job.current_step >= job.plan.length) {
    const results = Array.isArray(job.step_results) ? job.step_results : [];
    const result = compileResult(results);
    const verification = {
      status: results.length === job.plan.length && results.every((item) => typeof item.output === "string" && item.output.trim().length >= 40) ? "passed" : "attention",
      checkedAt: new Date().toISOString(),
      checks: [
        { name: "Every planned step has a substantive result", passed: results.length === job.plan.length && results.every((item) => typeof item.output === "string" && item.output.trim().length >= 40) },
        { name: "Final quality-review step is present", passed: /verif|review|quality|check|validate|audit/i.test(job.plan[job.plan.length - 1]?.title ?? "") },
      ],
      note: "These checks validate the generated deliverable and its step structure. They do not claim external repository tests, deployments, or live research were performed.",
    };
    const { error } = await admin.from("mission_jobs").update({
      status: "completed",
      result,
      verification,
      completed_at: new Date().toISOString(),
      lease_token: null,
      lease_expires_at: null,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("lease_token", job.lease_token).eq("status", "running");
    if (error) throw new Error("Could not finalize the mission.");
    return { processed: true, outcome: "completed" };
  }

  const step = job.plan[job.current_step];
  if (!step || typeof step.instruction !== "string") throw new Error("The stored mission plan is invalid.");
  const priorResults = (Array.isArray(job.step_results) ? job.step_results : [])
    .map((item, index) => `Step ${index + 1}: ${item.title}\n${item.output.slice(0, 2800)}`)
    .join("\n\n")
    .slice(-11_000);

  const output = await callModel(
    "You are KYVORIX Mission Agent, completing one bounded step in a durable background task. Work only from the user request, plan, and supplied prior results. Be useful, specific, and honest about uncertainty. Do not claim to browse the live web, inspect a repository, run code/tests, modify files, deploy software, or take other external actions. Produce a self-contained step deliverable. If this is a verification step, check consistency and completeness against the original request and clearly distinguish verified facts from assumptions.",
    `Mission: ${job.title}\n\nOriginal request:\n${job.prompt}\n\nFull plan:\n${job.plan.map((item, index) => `${index + 1}. ${item.title}: ${item.instruction}`).join("\n")}\n\nCompleted step results:\n${priorResults || "(This is the first execution step.)"}\n\nCurrent step (${job.current_step + 1} of ${job.plan.length}): ${step.title}\nInstruction: ${step.instruction}\n\nReturn the deliverable for this step only; do not repeat the full previous output.`,
    1800
  );

  if (output.trim().length < 40) throw new Error("The AI response was too short to save as a useful step result.");
  const previous = Array.isArray(job.step_results) ? job.step_results : [];
  const nextResults: StepResult[] = [...previous, {
    title: step.title,
    output: output.slice(0, MAX_OUTPUT_CHARS),
    completedAt: new Date().toISOString(),
  }];
  const isFinal = job.current_step + 1 >= job.plan.length;
  const finalResult = isFinal ? compileResult(nextResults) : null;
  const qualityStepPresent = /verif|review|quality|check|validate|audit/i.test(job.plan[job.plan.length - 1]?.title ?? "");
  const allSubstantive = nextResults.length === job.plan.length && nextResults.every((item) => item.output.trim().length >= 40);
  const verification = {
    status: allSubstantive && qualityStepPresent ? "passed" : "attention",
    checkedAt: new Date().toISOString(),
    checks: [
      { name: "Every planned step has a substantive result", passed: allSubstantive },
      { name: "Final quality-review step is present", passed: qualityStepPresent },
    ],
    note: "These checks validate the generated deliverable and its step structure. They do not claim external repository tests, deployments, or live research were performed.",
  };

  const { data, error } = await admin
    .from("mission_jobs")
    .update({
      step_results: nextResults,
      current_step: job.current_step + 1,
      status: isFinal ? "completed" : "queued",
      result: finalResult,
      verification: isFinal ? verification : {},
      attempt_count: 0,
      last_error: null,
      lease_token: null,
      lease_expires_at: null,
      next_run_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      completed_at: isFinal ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("lease_token", job.lease_token)
    .eq("current_step", job.current_step)
    .eq("status", "running")
    .eq("cancel_requested", false)
    .select("id,status")
    .maybeSingle();

  if (error) throw new Error("Could not save the mission step.");
  if (!data) {
    await admin.from("mission_jobs").update({
      status: "cancelled",
      lease_token: null,
      lease_expires_at: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("lease_token", job.lease_token).eq("cancel_requested", true);
    return { processed: true, outcome: "cancelled" };
  }
  return { processed: true, outcome: isFinal ? "completed" : "step_saved", step: job.current_step + 1 };
}

async function handleWorker(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization") ?? "";
  const suppliedBearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const timestamp = req.headers.get("x-mission-timestamp") ?? "";
  const suppliedSignature = req.headers.get("x-mission-signature") ?? "";
  const parsedTimestamp = /^\d{10}$/.test(timestamp) ? Number(timestamp) : 0;
  const timestampFresh = parsedTimestamp > 0 && Math.abs(Math.floor(Date.now() / 1000) - parsedTimestamp) <= 120;
  const expectedSignature = expected && timestampFresh
    ? createHmac("sha256", expected).update(`${timestamp}.{}`).digest("hex")
    : "";
  const validBearer = Boolean(expected && suppliedBearer && safeEqual(suppliedBearer, expected));
  const validSignature = Boolean(expectedSignature && suppliedSignature && safeEqual(suppliedSignature, expectedSignature));

  if (!expected || (!validBearer && !validSignature)) {
    return jsonError("Unauthorized worker request.", 401);
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc("claim_mission_job", { p_lease_seconds: 90 });
    if (error) {
      console.error("[mission-worker:claim]", error.message);
      return jsonError("The durable mission queue is not ready.", 503);
    }

    const job = (Array.isArray(data) ? data[0] : data) as MissionJob | null;
    if (!job) return NextResponse.json({ ok: true, claimed: false }, { headers: { "Cache-Control": "no-store" } });

    try {
      const outcome = await processClaimedJob(job);
      return NextResponse.json({ ok: true, claimed: true, jobId: job.id, ...outcome }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mission step failed unexpectedly.";
      const { data: recorded, error: recordError } = await admin.rpc("record_mission_failure", {
        p_job_id: job.id,
        p_lease_token: job.lease_token,
        p_error: message.slice(0, 1500),
      });
      if (recordError) console.error("[mission-worker:failure-record]", recordError.message);
      console.error("[mission-worker:step]", { jobId: job.id, message });
      return NextResponse.json({
        ok: false,
        claimed: true,
        jobId: job.id,
        outcome: recorded ? "retry_scheduled_or_failed" : "lease_lost",
      }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }
  } catch (error) {
    console.error("[mission-worker]", error instanceof Error ? error.message : "unknown error");
    return jsonError("Mission worker is temporarily unavailable.", 503);
  }
}

export async function GET(req: NextRequest) {
  return handleWorker(req);
}

export async function POST(req: NextRequest) {
  return handleWorker(req);
}
