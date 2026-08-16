import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import {
  startRAGChat,
  generateQuiz,
  summarizeDocument,
  compareDocuments,
  findContradictions,
} from "@/services/aiService";
import { AppError } from "@/lib/errors";
import type { QuizConfig } from "@/lib/ai/prompts/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatBody {
  workspaceId?: string;
  conversationId?: string;
  projectId?: string;
  question?: string;
}

export async function POST(request: NextRequest) {
  let body: ChatBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { workspaceId, conversationId, projectId, question } = body;
  if (!workspaceId || typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "workspaceId and question are required" }, { status: 400 });
  }

  try {
    const access = await requirePermission("ai:use", workspaceId);
    const result = await startRAGChat({
      workspaceId,
      userId: access.user._id.toString(),
      projectId,
      conversationId,
      question,
    });

    return new Response(result.stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof AppError ? err.message : "Failed to start chat";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface GenerateBody {
  action?: "quiz" | "summary" | "key_points" | "action_items" | "compare" | "contradictions";
  workspaceId?: string;
  documentId?: string;
  documentIds?: string[];
  quizConfig?: Partial<QuizConfig>;
  mode?: "summary" | "key_points" | "action_items";
}

export async function PUT(request: NextRequest) {
  let body: GenerateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workspaceId = body.workspaceId;
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    const access = await requirePermission("ai:use", workspaceId);
    const actor = { workspaceId, userId: access.user._id.toString() };

    switch (body.action) {
      case "quiz": {
        if (!body.documentId) return NextResponse.json({ error: "documentId is required" }, { status: 400 });
        const config: QuizConfig = {
          count: body.quizConfig?.count ?? 5,
          difficulty: body.quizConfig?.difficulty ?? "medium",
          type: body.quizConfig?.type ?? "multiple_choice",
        };
        const result = await generateQuiz({ ...actor, documentId: body.documentId, config });
        return NextResponse.json(result);
      }
      case "summary":
      case "key_points":
      case "action_items": {
        if (!body.documentId) return NextResponse.json({ error: "documentId is required" }, { status: 400 });
        const result = await summarizeDocument({
          ...actor,
          documentId: body.documentId,
          mode: body.action === "summary" ? "summary" : body.action,
        });
        return NextResponse.json(result);
      }
      case "compare": {
        if (!body.documentIds || body.documentIds.length !== 2) {
          return NextResponse.json({ error: "Exactly two documentIds required" }, { status: 400 });
        }
        const result = await compareDocuments({
          ...actor,
          documentIds: [body.documentIds[0], body.documentIds[1]],
        });
        return NextResponse.json(result);
      }
      case "contradictions": {
        if (!body.documentIds || body.documentIds.length < 2) {
          return NextResponse.json({ error: "At least two documentIds required" }, { status: 400 });
        }
        const result = await findContradictions({ ...actor, documentIds: body.documentIds });
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof AppError ? err.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
