// Vercel serverless function — plain JavaScript so @vercel/node bundles it
// with esbuild and never invokes a TypeScript compile step.
// POST /api/share keeps a memory's card for about a day; GET /api/share?id=… serves it back.
import { blobStore, createShare, imageHeaders, readShare } from "../server/share.mjs";

const store = () => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return Promise.resolve(null);
  return blobStore(token, process.env.SHARE_BLOB_ACCESS === "public" ? "public" : "private");
};

/** @param {Request} request */
export async function POST(request) {
  let bytes;
  try {
    bytes = new Uint8Array(await request.arrayBuffer());
  } catch {
    return Response.json({ error: "Could not read the image." }, { status: 400 });
  }
  const { status, body } = await createShare(await store(), bytes, request.headers.get("content-type"));
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** @param {Request} request */
export async function GET(request) {
  const id = new URL(request.url).searchParams.get("id");
  const found = await readShare(await store(), id);
  if (!found.image) return Response.json(found.body, { status: found.status, headers: { "Cache-Control": "no-store" } });
  return new Response(found.image.bytes, { status: 200, headers: imageHeaders(found.image, found.expiresAt) });
}
