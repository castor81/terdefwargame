// TERDEF – védett médiafeltöltés. Csak érvényes (szerver által kiadott) munkamenet-tokennel tölthető fel.
// A tárolóra nincs anon írási szabály; a feltöltés itt, service role-lal történik, típus- és méretellenőrzéssel.
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX = 10 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp",
  "video/mp4": "mp4", "video/webm": "webm", "audio/mpeg": "mp3", "audio/mp4": "m4a",
  "audio/wav": "wav", "audio/ogg": "ogg", "audio/webm": "weba", "application/pdf": "pdf",
};
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-tdw-session, x-file-name, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const sess = req.headers.get("x-tdw-session") || "";
  const { data: who, error: ae } = await sb.rpc("tdw_check", { p_s: sess });
  if (ae || !who || who.role === "cop") return json({ error: "unauthorized" }, 401);
  const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = EXT[type];
  if (!ext) return json({ error: "type_not_allowed" }, 415);
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX) return json({ error: "too_large" }, 413);
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX) return json({ error: "too_large" }, 413);
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("tdw-media").upload(path, buf, { contentType: type, upsert: false });
  if (error) return json({ error: "upload_failed" }, 500);
  const url = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/tdw-media/${path}`;
  let name = "";
  try { name = decodeURIComponent(req.headers.get("x-file-name") || ""); } catch (_) { /* ignore */ }
  return json({ url, name: name.slice(0, 200) });
});
