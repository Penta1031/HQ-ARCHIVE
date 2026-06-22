const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}

function extractYoutubeId(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("youtube_url이 올바른 URL 형식이 아닙니다.");
  }

  if (url.protocol !== "https:") {
    throw new Error("HTTPS YouTube 링크만 지원합니다.");
  }

  const host = url.hostname.toLowerCase();
  let youtubeId = "";

  if (host === "youtu.be") {
    youtubeId = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (host === "www.youtube.com" || host === "youtube.com") {
    if (url.pathname === "/watch") {
      youtubeId = url.searchParams.get("v") || "";
    } else if (url.pathname.startsWith("/shorts/")) {
      youtubeId = url.pathname.split("/").filter(Boolean)[1] || "";
    }
  }

  if (!/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
    throw new Error("지원하지 않는 YouTube 링크이거나 VIDEO_ID가 올바르지 않습니다.");
  }

  return youtubeId;
}

function errorDetail(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const nested = record.error;
  if (nested && typeof nested === "object") {
    const message = (nested as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  return typeof record.message === "string" ? record.message : "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "POST 요청만 지원합니다." }, 405);

  try {
    const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY") || "";
    if (!youtubeApiKey) {
      return json({ ok: false, error: "Supabase Secret에 YOUTUBE_API_KEY가 설정되지 않았습니다." }, 500);
    }

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "Supabase 서버 환경변수가 설정되지 않았습니다." }, 500);
    }
    if (request.headers.get("authorization") !== `Bearer ${serviceRoleKey}`) {
      return json({ ok: false, error: "이 등록 Function을 실행할 권한이 없습니다." }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "요청 본문은 JSON이어야 합니다." }, 400);
    }

    const youtubeUrl = typeof body.youtube_url === "string" ? body.youtube_url.trim() : "";
    if (!youtubeUrl) return json({ ok: false, error: "youtube_url이 필요합니다." }, 400);

    let youtubeId: string;
    try {
      youtubeId = extractYoutubeId(youtubeUrl);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : "YouTube 링크를 확인할 수 없습니다." }, 400);
    }

    const youtubeApiUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    youtubeApiUrl.searchParams.set("part", "snippet");
    youtubeApiUrl.searchParams.set("id", youtubeId);
    youtubeApiUrl.searchParams.set("key", youtubeApiKey);

    const youtubeResponse = await fetch(youtubeApiUrl);
    const youtubeResult = await youtubeResponse.json().catch(() => ({}));
    if (!youtubeResponse.ok) {
      const detail = errorDetail(youtubeResult);
      return json({
        ok: false,
        error: `YouTube Data API 호출에 실패했습니다 (${youtubeResponse.status})${detail ? `: ${detail}` : ""}`
      }, 502);
    }

    const item = Array.isArray(youtubeResult.items) ? youtubeResult.items[0] : null;
    const snippet = item && typeof item === "object" ? item.snippet : null;
    if (!snippet || typeof snippet !== "object") {
      return json({ ok: false, error: "YouTube Data API에서 해당 영상을 찾을 수 없습니다." }, 404);
    }

    const thumbnails = snippet.thumbnails && typeof snippet.thumbnails === "object"
      ? snippet.thumbnails as Record<string, { url?: string }>
      : {};
    const thumbnailUrl = thumbnails.maxres?.url || thumbnails.standard?.url || thumbnails.high?.url
      || thumbnails.medium?.url || thumbnails.default?.url || null;

    const row = {
      youtube_id: youtubeId,
      youtube_url: youtubeUrl,
      title: typeof snippet.title === "string" ? snippet.title : null,
      published_at: typeof snippet.publishedAt === "string" ? snippet.publishedAt : null,
      thumbnail_url: thumbnailUrl,
      channel_id: typeof snippet.channelId === "string" ? snippet.channelId : null,
      channel_title: typeof snippet.channelTitle === "string" ? snippet.channelTitle : null,
      source: "manual"
    };

    const databaseHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    };
    const youtubeIdFilter = encodeURIComponent(youtubeId);
    const existingResponse = await fetch(
      `${supabaseUrl}/rest/v1/recommended_videos?select=id&youtube_id=eq.${youtubeIdFilter}&limit=1`,
      { headers: databaseHeaders }
    );
    const existingRows = await existingResponse.json().catch(() => null);
    if (!existingResponse.ok) {
      const detail = errorDetail(existingRows);
      return json({
        ok: false,
        error: `recommended_videos 조회에 실패했습니다 (${existingResponse.status})${detail ? `: ${detail}` : ""}`
      }, 500);
    }

    const exists = Array.isArray(existingRows) && existingRows.length > 0;
    const databaseResponse = await fetch(
      exists
        ? `${supabaseUrl}/rest/v1/recommended_videos?youtube_id=eq.${youtubeIdFilter}`
        : `${supabaseUrl}/rest/v1/recommended_videos`,
      {
        method: exists ? "PATCH" : "POST",
        headers: { ...databaseHeaders, Prefer: "return=representation" },
        body: JSON.stringify(exists ? row : {
          ...row,
          is_active: false,
          is_featured: false,
          categories: []
        })
      }
    );
    const databaseResult = await databaseResponse.json().catch(() => null);
    if (!databaseResponse.ok) {
      const detail = errorDetail(databaseResult);
      return json({
        ok: false,
        error: `recommended_videos 저장에 실패했습니다 (${databaseResponse.status})${detail ? `: ${detail}` : ""}`
      }, 500);
    }

    const saved = Array.isArray(databaseResult) ? databaseResult[0] : databaseResult;
    return json({ ok: true, data: saved });
  } catch (error) {
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "알 수 없는 서버 오류가 발생했습니다."
    }, 500);
  }
});
