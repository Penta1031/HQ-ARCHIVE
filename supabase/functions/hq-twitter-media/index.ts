const allowedOrigins = (Deno.env.get("HQ_ALLOWED_ORIGINS") || "https://penta1031.github.io,http://localhost:3000").split(",").map((value) => value.trim());
function cors(request: Request) { const origin = request.headers.get("origin") || ""; return { "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0], "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" }; }
function json(request: Request, data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...cors(request), "Content-Type": "application/json" } }); }
const text = (value: unknown) => String(value ?? "").trim();
function tweet(sourceUrl: string) { const match = sourceUrl.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)\/(?:status|statuses)\/(\d+)/i); return match ? { user: match[1], id: match[2] } : null; }
function asArray(value: unknown) { return Array.isArray(value) ? value : value ? [value] : []; }
function firstText(...values: unknown[]) { return values.map(text).find(Boolean) || ""; }
function isVideoUrl(url: string) { return /video\.twimg\.com|\/ext_tw_video\/|\.(mp4|m3u8)(?:$|\?)/i.test(url); }
function bestVideoUrl(item: Record<string, any>) {
  const variants = [...asArray(item.variants), ...asArray(item.video_info?.variants)]
    .filter((variant: any) => variant?.url && (/mp4/i.test(variant.content_type || "") || /\.mp4(?:$|\?)/i.test(variant.url)))
    .sort((a: any, b: any) => Number(b.bitrate || 0) - Number(a.bitrate || 0));
  return text((variants[0] as any)?.url);
}
function mediaResult(url: string, isVideo: boolean, item: Record<string, any>, data: Record<string, any>) {
  const thumbnailUrl = firstText(
    item.thumbnail_url,
    item.preview_image_url,
    item.media_url_https,
    item.media_url,
    item.cover_url,
    item.poster,
    data.thumbnail_url,
    data.preview_image_url,
    data.poster,
    data.tweet?.media?.thumbnail_url,
    data.tweet?.video?.thumbnail_url,
    data.tweet?.video?.preview_image_url,
  );
  return {
    url,
    type: isVideo ? "video" : "image",
    isVideo,
    width: Number(item.width || item.original_info?.width || item.size?.width || 0),
    height: Number(item.height || item.original_info?.height || item.size?.height || 0),
    poster: thumbnailUrl,
    thumbnailUrl,
    thumbnail_url: thumbnailUrl,
    preview_image_url: thumbnailUrl,
  };
}
function media(data: Record<string, unknown>) {
  const payload = data as Record<string, any>;
  const all = [
    ...asArray(payload.media_extended),
    ...asArray(payload.tweet?.media?.all),
    ...asArray(payload.media?.all),
    ...asArray(payload.mediaURLs),
    ...asArray(payload.media_urls),
  ];
  let image = null as ReturnType<typeof mediaResult> | null;
  for (const item of all as Record<string, any>[]) {
    const itemObject = typeof item === "string" ? { url: item } : item;
    const videoUrl = bestVideoUrl(itemObject);
    const url = videoUrl || firstText(itemObject.url, itemObject.media_url_https, itemObject.media_url, itemObject.thumbnail_url, itemObject.preview_image_url);
    if (!url) continue;
    const isVideo = Boolean(videoUrl) || /video|gif/i.test(itemObject.type || "") || isVideoUrl(url);
    const result = mediaResult(url, isVideo, itemObject, payload);
    if (isVideo) return result; if (!image) image = result;
  }
  const directVideo = firstText(payload.video_url, payload.tweet?.video?.url);
  if (directVideo) return mediaResult(directVideo, true, payload.tweet?.video || {}, payload);
  return image;
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  try {
    const payload = await request.json(); const parsed = tweet(text(payload.sourceUrl));
    if (!parsed) return json(request, { ok: false, error: "올바른 X/Twitter 주소가 아닙니다." }, 400);
    for (const endpoint of [`https://api.vxtwitter.com/${parsed.user}/status/${parsed.id}`, `https://api.fxtwitter.com/${parsed.user}/status/${parsed.id}`]) {
      try { const response = await fetch(endpoint); if (response.ok) { const resolved = media(await response.json()); if (resolved) return json(request, { ok: true, data: { ...resolved, sourceUrl: payload.sourceUrl, tweetId: parsed.id } }); } } catch {}
    }
    return json(request, { ok: false, error: "미디어를 찾지 못했습니다." }, 404);
  } catch (error) { return json(request, { ok: false, error: error instanceof Error ? error.message : String(error) }, 500); }
});
