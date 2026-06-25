const defaultChannelUrls = [
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

type SyncSummary = {
  source_url: string;
  playlist_id: string;
  playlist_title?: string | null;
  channel_id: string | null;
  channel_title: string | null;
  pages: number;
  discovered: number;
  inserted: number;
  skipped_existing: number;
  stopped_at_existing: boolean;
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

function uniqueCleanUrls(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))]
    : [];
}

function channelReference(channelUrl: string) {
  let url: URL;
  try {
    url = new URL(channelUrl);
  } catch {
    throw new FunctionError(`채널 URL 형식이 올바르지 않습니다: ${channelUrl}`, 400);
  }

  if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname.toLowerCase())) {
    throw new FunctionError(`YouTube 채널 URL만 지원합니다: ${channelUrl}`, 400);
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0]?.startsWith("@")) return { handle: segments[0] };
  if (segments[0] === "channel" && segments[1]) return { channelId: segments[1] };
  throw new FunctionError(`지원하지 않는 YouTube 채널 URL입니다: ${channelUrl}`, 400);
}

function playlistReference(playlistUrl: string) {
  const raw = String(playlistUrl || "").trim();
  if (/^[A-Za-z0-9_-]{10,}$/.test(raw) && !/^https?:\/\//i.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FunctionError(`플레이리스트 URL 형식이 올바르지 않습니다: ${playlistUrl}`, 400);
  }

  if (!["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(url.hostname.toLowerCase())) {
    throw new FunctionError(`YouTube 플레이리스트 URL만 지원합니다: ${playlistUrl}`, 400);
  }

  const playlistId = url.searchParams.get("list") || "";
  if (!playlistId) throw new FunctionError(`플레이리스트 ID를 찾을 수 없습니다: ${playlistUrl}`, 400);
  return playlistId;
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

    if (!youtubeApiKey) throw new FunctionError("Supabase Secret에 YOUTUBE_API_KEY가 설정되지 않았습니다.");
    if (!supabaseUrl || !serviceRoleKey) throw new FunctionError("Supabase 서버 환경변수가 설정되지 않았습니다.");
    if (request.headers.get("authorization") !== `Bearer ${serviceRoleKey}`) {
      throw new FunctionError("이 수집 Function을 실행할 권한이 없습니다.", 401);
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const requestedChannelUrls = uniqueCleanUrls(body.channel_urls);
    const requestedPlaylistUrls = uniqueCleanUrls(body.playlist_urls);
    if (requestedChannelUrls.length > 10) throw new FunctionError("한 번에 수집할 채널은 10개 이하여야 합니다.", 400);
    if (requestedPlaylistUrls.length > 10) throw new FunctionError("한 번에 수집할 플레이리스트는 10개 이하여야 합니다.", 400);
    const channelUrls = requestedPlaylistUrls.length ? [] : (requestedChannelUrls.length ? requestedChannelUrls : defaultChannelUrls);

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
      if (!channelId) throw new FunctionError(`YouTube 채널 ID를 찾을 수 없습니다: ${channelUrl}`, 404);
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
        throw new FunctionError(`recommended_videos 저장에 실패했습니다 (${response.status})${detail ? `: ${detail}` : ""}`);
      }
      return Array.isArray(result) ? result.length : 0;
    }

    async function existingYoutubeIds(videoIds: string[]) {
      if (!videoIds.length) return new Set<string>();
      const response = await fetch(
        `${supabaseUrl}/rest/v1/recommended_videos?select=youtube_id&youtube_id=in.(${videoIds.join(",")})&limit=50`,
        { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
      );
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = detailFrom(result);
        throw new FunctionError(`기존 추천 영상 조회에 실패했습니다 (${response.status})${detail ? `: ${detail}` : ""}`);
      }
      return new Set((Array.isArray(result) ? result : []).map((row) => row?.youtube_id).filter((value): value is string => typeof value === "string"));
    }

    let totalDiscovered = 0;
    let totalInserted = 0;

    async function collectPlaylistVideos({
      playlistId,
      sourceUrl,
      playlistTitle = null,
      channelId,
      channelTitle,
      source,
      stopAtExisting
    }: {
      playlistId: string;
      sourceUrl: string;
      playlistTitle?: string | null;
      channelId: string | null;
      channelTitle: string | null;
      source: string;
      stopAtExisting: boolean;
    }): Promise<SyncSummary> {
      let pageToken = "";
      let pages = 0;
      let discovered = 0;
      let inserted = 0;
      let stoppedAtExisting = false;

      do {
        const playlistResult = await youtubeRequest("playlistItems", {
          part: "snippet,contentDetails",
          playlistId,
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
          const itemChannelId = typeof snippet.videoOwnerChannelId === "string" ? snippet.videoOwnerChannelId
            : typeof snippet.channelId === "string" ? snippet.channelId : channelId;
          const itemChannelTitle = typeof snippet.videoOwnerChannelTitle === "string" ? snippet.videoOwnerChannelTitle
            : typeof snippet.channelTitle === "string" ? snippet.channelTitle : channelTitle;
          return [{
            youtube_id: videoId,
            youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
            title: typeof snippet.title === "string" ? snippet.title : null,
            published_at: publishedAt,
            thumbnail_url: thumbnailUrl(snippet.thumbnails),
            channel_id: itemChannelId,
            channel_title: itemChannelTitle,
            source,
            is_active: false,
            is_featured: false,
            categories: [],
            admin_comment: null
          }];
        });

        const existingIds = await existingYoutubeIds(rows.map((row) => String(row.youtube_id || "")).filter(Boolean));
        const newRows = rows.filter((row) => !existingIds.has(String(row.youtube_id || "")));
        discovered += rows.length;
        inserted += await saveNewVideos(newRows);
        pages += 1;
        pageToken = typeof playlistResult.nextPageToken === "string" ? playlistResult.nextPageToken : "";
        if (stopAtExisting && existingIds.size) {
          stoppedAtExisting = true;
          pageToken = "";
        }
      } while (pageToken);

      totalDiscovered += discovered;
      totalInserted += inserted;

      return {
        source_url: sourceUrl,
        playlist_id: playlistId,
        playlist_title: playlistTitle,
        channel_id: channelId,
        channel_title: channelTitle,
        pages,
        discovered,
        inserted,
        skipped_existing: discovered - inserted,
        stopped_at_existing: stoppedAtExisting
      };
    }

    const summaries: SyncSummary[] = [];

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

      summaries.push(await collectPlaylistVideos({
        playlistId: uploadsPlaylistId,
        sourceUrl: channelUrl,
        playlistTitle: typeof channelSnippet?.title === "string" ? `${channelSnippet.title} uploads` : null,
        channelId,
        channelTitle: typeof channelSnippet?.title === "string" ? channelSnippet.title : null,
        source: "channel_auto",
        stopAtExisting: true
      }));
    }

    for (const playlistUrl of requestedPlaylistUrls) {
      const playlistId = playlistReference(playlistUrl);
      const playlistResult = await youtubeRequest("playlists", {
        part: "snippet",
        id: playlistId,
        maxResults: "1"
      });
      const playlist = Array.isArray(playlistResult.items) ? playlistResult.items[0] : null;
      if (!playlist) throw new FunctionError(`플레이리스트를 찾을 수 없습니다: ${playlistUrl}`, 404);
      const snippet = playlist.snippet || {};

      summaries.push(await collectPlaylistVideos({
        playlistId,
        sourceUrl: playlistUrl,
        playlistTitle: typeof snippet.title === "string" ? snippet.title : null,
        channelId: typeof snippet.channelId === "string" ? snippet.channelId : null,
        channelTitle: typeof snippet.channelTitle === "string" ? snippet.channelTitle : null,
        source: "playlist_auto",
        stopAtExisting: false
      }));
    }

    return json({
      ok: true,
      channels: summaries,
      playlists: summaries.filter((item) => item.source_url.includes("list=") || item.source_url === item.playlist_id),
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
