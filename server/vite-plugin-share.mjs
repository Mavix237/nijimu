import { networkInterfaces } from "node:os";
import { blobStore, createShare, imageHeaders, memoryStore, readShare } from "./share.mjs";

/** This machine's address on the local network, so a phone can reach the dev server. */
function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

/**
 * Mounts /api/share on the Vite dev server, mirroring api/share.mjs. With
 * BLOB_READ_WRITE_TOKEN set it uses the real Blob store; without it the cards
 * are kept in memory until the dev server restarts. The answer also carries
 * `origin`: the address a phone on the same network can open (the page's own
 * host, or this machine's LAN address when the page was opened on localhost).
 * @param {{ token: string | undefined, access?: string }} options
 * @returns {import("vite").Plugin}
 */
export function shareApiPlugin({ token, access }) {
  const store = token ? blobStore(token, access === "public" ? "public" : "private") : Promise.resolve(memoryStore());
  return {
    name: "nijimu-share-api",
    configureServer(server) {
      server.middlewares.use("/api/share", async (req, res) => {
        const json = (status, body) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(body));
        };
        if (req.method === "GET") {
          const id = new URL(req.url ?? "", "http://dev").searchParams.get("id");
          const found = await readShare(await store, id);
          if (!found.image) return json(found.status, found.body);
          for (const [k, v] of Object.entries(imageHeaders(found.image, found.expiresAt))) res.setHeader(k, v);
          const { bytes } = found.image;
          if (bytes instanceof Uint8Array) { res.end(Buffer.from(bytes)); return; }
          res.end(Buffer.from(await new Response(bytes).arrayBuffer()));
          return;
        }
        if (req.method !== "POST") return json(405, { error: "Method not allowed" });
        /** @type {Buffer[]} */
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", async () => {
          const { status, body } = await createShare(await store, new Uint8Array(Buffer.concat(chunks)), req.headers["content-type"]);
          const host = String(req.headers.host ?? "");
          const [name, port] = host.split(":");
          const local = name === "localhost" || name === "127.0.0.1" || name === "[::1]";
          const lan = local ? lanAddress() : null;
          const scheme = server.config.server.https ? "https" : "http";
          json(status, status === 200 && lan ? { ...body, origin: `${scheme}://${lan}${port ? `:${port}` : ""}` } : body);
        });
      });
    },
  };
}
