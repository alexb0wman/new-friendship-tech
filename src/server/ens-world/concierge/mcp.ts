import { z } from "zod";
import { AppError } from "@/server/errors";
import { rateLimit } from "@/server/http";
import { conciergeName } from "@/server/ens-v2/names";
import { openTables, resolveTrip, TOOL_DEFINITIONS, whoIsAround } from "./tools";
import "../handlers";

/**
 * The endpoint published in the concierge's agent-endpoint[mcp] record: a minimal, stateless
 * Model Context Protocol server over HTTP JSON-RPC exposing three read-only tools. No session,
 * no auth beyond the shared anonymous rate limit, no writes. Other agents can find out who is
 * around and which tables are open; putting anyone in a room still goes through a member's
 * World ID approval inside the app.
 */
const PROTOCOL_VERSION = "2025-06-18";
const request = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const error = (id: unknown, code: number, message: string, status = 200) =>
  json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, status);
async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "resolveTrip":
      return resolveTrip(z.object({ name: z.string().min(3).max(255) }).parse(args).name);
    case "openTables":
      return openTables(z.object({ city: z.string().regex(/^[a-z-]+$/) }).parse(args).city);
    case "whoIsAround":
      return whoIsAround(z.object({ city: z.string().regex(/^[a-z-]+$/) }).parse(args).city);
    default:
      throw new AppError("UNKNOWN_TOOL", "Unknown tool: " + name, 404);
  }
}
export async function handleMcp(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "Use POST with a JSON-RPC 2.0 body." }, 405);
  try {
    await rateLimit(req);
  } catch (caught) {
    if (caught instanceof AppError) return error(null, -32000, caught.message, caught.status);
    throw caught;
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error(null, -32700, "Parse error", 400);
  }
  if (Array.isArray(body)) return error(null, -32600, "Batches are not supported", 400);
  const parsed = request.safeParse(body);
  if (!parsed.success) return error(null, -32600, "Invalid request", 400);
  const { id, method, params = {} } = parsed.data;
  if (method.startsWith("notifications/")) return new Response(null, { status: 202 });
  try {
    switch (method) {
      case "initialize":
        return json({
          jsonrpc: "2.0",
          id: id ?? null,
          result: {
            protocolVersion:
              typeof params.protocolVersion === "string"
                ? params.protocolVersion
                : PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "friendship-concierge", version: "0.1.0" },
            instructions:
              "Read-only concierge for New Friendship Tech, published on " +
              safeConciergeName() +
              ". Tools return trip names and public presence only.",
          },
        });
      case "ping":
        return json({ jsonrpc: "2.0", id: id ?? null, result: {} });
      case "tools/list":
        return json({ jsonrpc: "2.0", id: id ?? null, result: { tools: TOOL_DEFINITIONS } });
      case "tools/call": {
        const call = z
          .object({ name: z.string(), arguments: z.record(z.string(), z.unknown()).optional() })
          .safeParse(params);
        if (!call.success) return error(id, -32602, "Invalid params");
        try {
          const result = await callTool(call.data.name, call.data.arguments ?? {});
          return json({
            jsonrpc: "2.0",
            id: id ?? null,
            result: { content: [{ type: "text", text: JSON.stringify(result) }], isError: false },
          });
        } catch (caught) {
          if (caught instanceof AppError && caught.code === "UNKNOWN_TOOL")
            return error(id, -32602, caught.message);
          const message =
            caught instanceof AppError ? caught.message : "The tool could not complete.";
          return json({
            jsonrpc: "2.0",
            id: id ?? null,
            result: { content: [{ type: "text", text: message }], isError: true },
          });
        }
      }
      default:
        return error(id, -32601, "Method not found");
    }
  } catch (caught) {
    return error(id, -32603, caught instanceof AppError ? caught.message : "Internal error");
  }
}
function safeConciergeName() {
  try {
    return conciergeName();
  } catch {
    return "the concierge name";
  }
}
