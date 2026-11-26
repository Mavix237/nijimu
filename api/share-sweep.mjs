// Vercel cron (vercel.json "crons"): deletes kept cards older than a day.
// Plain JavaScript on purpose (see AGENTS.md §9). Vercel sends
// `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set; anything else is refused.
import { blobStore } from "../server/share.mjs";

/** @param {Request} request */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return Response.json({ swept: 0, note: "no blob store" });
  const store = await blobStore(token, process.env.SHARE_BLOB_ACCESS === "public" ? "public" : "private");
  const swept = await store.sweep(Date.now());
  return Response.json({ swept });
}
