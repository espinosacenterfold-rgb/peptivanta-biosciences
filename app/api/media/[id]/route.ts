import { ensureCommunitySchema, getD1, getMediaStore } from "../../../../db";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await ensureCommunitySchema();
    const { id } = await context.params;
    const d1 = await getD1();
    const asset = await d1
      .prepare(
        `SELECT r2_key, mime_type
         FROM media_library_assets
         WHERE public_id = ? AND status = 'approved' AND r2_key <> ''
           AND datetime(expires_at) > CURRENT_TIMESTAMP
         LIMIT 1`,
      )
      .bind(id)
      .first<{ r2_key: string; mime_type: string }>();
    if (!asset) return new Response("Not found", { status: 404 });
    const media = await getMediaStore();
    const object = await media.get(asset.r2_key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", asset.mime_type || headers.get("Content-Type") || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(object.body, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
