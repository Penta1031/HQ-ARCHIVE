const channelUrls = [
  "https://www.youtube.com/@SeungHyub2",
  "https://www.youtube.com/@nflyingofficial/videos",
  "https://www.youtube.com/@YooHweSeung",
  "https://www.youtube.com/@nflying_vlive"
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

class FunctionError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}

function detailFrom(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const nested = record.error;
  if (nested && typeof nested === "object") {
    const message = (nested as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  return typeof record.message === "string" ? record.message : "";
}

function channelReference(channelUrl: string) {
  let url: URL;
  try {
    url = new URL(channelUrl);
  } catch {
    throw new FunctionError(`채널 URL 형식이 올바르지 않습니다: ${channelUrl}`, 400);
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0]?.startsWith("@")) return { handle: segments[0] };
  if (segments[0] === "channel" && segments[1]) return { channelId: segments[1] };
  throw new FunctionError(`지원하지 않는 YouTube 채널 URL입니다: ${channelUrl}`, 400);
}

function thumbnailUrl(thumbnails: unknown) {
  if (!thumbnails || typeof thumbnails !== "object") return null;
  const values = thumbnails as Record<string, { url?: string }>;
  return values.maxres?.url || values.standard?.url || values.high?.url
    || values.medium?.url || values.default?.url || null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, error: "POST 요청만 지원합니다." }, 405);

  try {
    const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY") || "";
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!youtubeApiKey) {
      throw new FunctionError("Supabase Secret에 YOUTUBE_API_KEY가 설정되지 않았습니다.");
    }
    if (!supabaseUrl || !serviceRoleKey) {
      throw new FunctionError("Supabase 서버 환경변수가 설정되지 않았습니다.");
    }
    if (request.headers.get("authorization") !== `Bearer ${serviceRoleKey}`) {
      throw new FunctionError("이 수집 Function을 실행할 권한이 없습니다.", 401);
    }

    async function youtubeRequest(resource: string, params: Record<string, string>) {
      const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      url.searchParams.set("key", youtubeApiKey);

      const response = await fetch(url);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = detailFrom(result);
        throw new FunctionError(
          `YouTube Data API ${resource} 호출에 실패했습니다 (${response.status})${detail ? `: ${detail}` : ""}`,
          502
        );
      }
      return result as Record<string, unknown>;
    }

    async function resolveChannelId(channelUrl: string) {
      const reference = channelReference(channelUrl);
      if ("channelId" in reference) return reference.channelId;

      const result = await youtubeRequest("channels", {
        part: "id",
        forHandle: reference.handle
      });
      const item = Array.isArray(result.items) ? result.items[0] : null;
      const channelId = item && typeof item.id === "string" ? item.id : "";
      if (!channelId) {
        throw new FunctionError(`YouTube 채널 ID를 찾을 수 없습니다: ${channelUrl}`, 404);
      }
      return channelId;
    }

    async function saveNewVideos(rows: Array<Record<string, unknown>>) {
      if (!rows.length) return 0;
      const response = await fetch(
        `${supabaseUrl}/rest/v1/recommended_videos?on_conflict=youtube_id`,
        {
          method: "POST",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "resolution=ignore-duplicates,return=representation"
          },
          body: JSON.stringify(rows)
        }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = detailFrom(result);
        throw new FunctionError(
          `recommended_videos 저장에 실패했습니다 (${response.status})${detail ? `: ${detail}` : ""}`
        );
      }
      return Array.isArray(result) ? result.length : 0;
    }

    const summaries: Array<Record<string, unknown>> = [];
    let totalDiscovered = 0;
    let totalInserted = 0;

    for (const channelUrl of channelUrls) {
      const channelId = await resolveChannelId(channelUrl);
      const channelResult = await youtubeRequest("channels", {
        part: "snippet,contentDetails",
        id: channelId
      });
      const channel = Array.isArray(channelResult.items) ? channelResult.items[0] : null;
      const channelSnippet = channel?.snippet;
      const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;
      if (!channel || typeof uploadsPlaylistId !== "string") {
        throw new FunctionError(`업로드 재생목록을 찾을 수 없습니다: ${channelUrl}`, 404);
      }

      const channelTitle = typeof channelSnippet?.title === "string" ? channelSnippet.title : null;
      let pageToken = "";
      let pages = 0;
      let discovered = 0;
      let inserted = 0;

      do {
        const playlistResult = await youtubeRequest("playlistItems", {
          part: "snippet,contentDetails",
          playlistId: uploadsPlaylistId,
          maxResults: "50",
          ...(pageToken ? { pageToken } : {})
        });
        const items = Array.isArray(playlistResult.items) ? playlistResult.items : [];
        const seenOnPage = new Set<string>();
        const rows = items.flatMap((item) => {
          const videoId = typeof item?.contentDetails?.videoId === "string"
            ? item.contentDetails.videoId
            : item?.snippet?.resourceId?.videoId;
          if (typeof videoId !== "string" || !videoId || seenOnPage.has(videoId)) return [];
          seenOnPage.add(videoId);

          const snippet = item.snippet || {};
          const publishedAt = typeof item?.contentDetails?.videoPublishedAt === "string"
            ? item.contentDetails.videoPublishedAt
            : typeof snippet.publishedAt === "string" ? snippet.publishedAt : null;
          return [{
            youtube_id: videoId,
            youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
            title: typeof snippet.title === "string" ? snippet.title : null,
            published_at: publishedAt,
            thumbnail_url: thumbnailUrl(snippet.thumbnails),
            channel_id: channelId,
            channel_title: channelTitle,
            source: "channel_auto",
            is_active: false,
            is_featured: false,
            categories: [],
            admin_comment: null
          }];
        });

        discovered += rows.length;
        inserted += await saveNewVideos(rows);
        pages += 1;
        pageToken = typeof playlistResult.nextPageToken === "string" ? playlistResult.nextPageToken : "";
      } while (pageToken);

      totalDiscovered += discovered;
      totalInserted += inserted;
      summaries.push({
        channel_url: channelUrl,
        channel_id: channelId,
        channel_title: channelTitle,
        pages,
        discovered,
        inserted,
        skipped_existing: discovered - inserted
      });
    }

    return json({
      ok: true,
      channels: summaries,
      total_discovered: totalDiscovered,
      total_inserted: totalInserted,
      total_skipped_existing: totalDiscovered - totalInserted
    });
  } catch (error) {
    const status = error instanceof FunctionError ? error.status : 500;
    return json({
      ok: false,
      error: error instanceof Error ? error.message : "알 수 없는 서버 오류가 발생했습니다."
    }, status);
  }
});
