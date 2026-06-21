// HQ ARCHIVE X/Twitter 미디어 전용 해석기
//
// 1) 이 파일을 현재 HQ ARCHIVE Apps Script 프로젝트에 추가하세요.
// 2) 기존 doPost(e)에서 action/requestData를 만든 직후 아래 2줄을 추가하세요.
//
// var twitterMediaResponse = handleTwitterMediaAction_(action, requestData);
// if (twitterMediaResponse) return createJsonResponse(twitterMediaResponse);
//
// 3) 웹 앱을 새 버전으로 배포하세요. 기존 실행 URL은 그대로 유지할 수 있습니다.

function handleTwitterMediaAction_(action, requestData) {
  if (action !== "resolveTweetMedia") return null;
  try {
    var sourceUrl = String((requestData || {}).sourceUrl || "").trim();
    return { status: "success", data: resolveTweetMedia_(sourceUrl) };
  } catch (error) {
    return { status: "error", message: error && error.message ? error.message : "트윗 미디어를 불러오지 못했습니다." };
  }
}

function resolveTweetMedia_(sourceUrl) {
  var tweet = parseTweetUrl_(sourceUrl);
  if (!tweet) throw new Error("올바른 X/Twitter 게시물 주소가 아닙니다.");

  var cache = CacheService.getScriptCache();
  var cacheKey = "hq-tweet-media-" + tweet.id;
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var endpoints = [
    "https://api.vxtwitter.com/" + tweet.user + "/status/" + tweet.id,
    "https://api.fxtwitter.com/" + tweet.user + "/status/" + tweet.id
  ];
  var resolved = null;

  for (var index = 0; index < endpoints.length && !resolved; index++) {
    try {
      var response = UrlFetchApp.fetch(endpoints[index], {
        method: "get",
        followRedirects: true,
        muteHttpExceptions: true,
        headers: { "User-Agent": "HQ-Archive-Media-Resolver/1.0" }
      });
      if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) continue;
      resolved = normalizeTweetMedia_(JSON.parse(response.getContentText()));
    } catch (error) {
      // 다음 제공자를 시도합니다.
    }
  }

  if (!resolved || !resolved.url) throw new Error("게시물에서 이미지나 영상을 찾지 못했습니다.");
  resolved.sourceUrl = sourceUrl;
  resolved.tweetId = tweet.id;
  cache.put(cacheKey, JSON.stringify(resolved), 21600);
  return resolved;
}

function parseTweetUrl_(sourceUrl) {
  var matched = String(sourceUrl || "").match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)\/(?:status|statuses)\/(\d+)/i);
  if (!matched) return null;
  return { user: matched[1] === "i" ? "i" : matched[1], id: matched[2] };
}

function normalizeTweetMedia_(data) {
  data = data || {};
  var extended = toArray_(data.media_extended)
    .concat(toArray_(data.tweet && data.tweet.media && data.tweet.media.all))
    .concat(toArray_(data.media && data.media.all));
  var urls = toArray_(data.mediaURLs).concat(toArray_(data.media_urls));
  var selected = null;

  // 영상이 있으면 가장 높은 화질의 MP4를 우선합니다.
  for (var index = 0; index < extended.length; index++) {
    var candidate = extended[index] || {};
    var candidateUrl = bestVideoUrl_(candidate) || candidate.url || candidate.media_url_https || candidate.media_url;
    if (!candidateUrl) continue;
    var type = String(candidate.type || "").toLowerCase();
    var isVideo = /video|gif/.test(type) || /\.(mp4|m3u8)(?:$|\?)/i.test(candidateUrl);
    var normalized = mediaResult_(candidateUrl, isVideo, candidate);
    if (isVideo) return normalized;
    if (!selected) selected = normalized;
  }

  for (var urlIndex = 0; urlIndex < urls.length; urlIndex++) {
    var url = typeof urls[urlIndex] === "string" ? urls[urlIndex] : (urls[urlIndex] || {}).url;
    if (!url) continue;
    var urlIsVideo = /\.(mp4|m3u8)(?:$|\?)/i.test(url) || /video\.twimg\.com/i.test(url);
    var result = mediaResult_(url, urlIsVideo, {});
    if (urlIsVideo) return result;
    if (!selected) selected = result;
  }

  var directVideo = data.video_url || (data.tweet && data.tweet.video && data.tweet.video.url);
  if (directVideo) return mediaResult_(directVideo, true, data.tweet && data.tweet.video || {});
  return selected;
}

function bestVideoUrl_(media) {
  var variants = toArray_(media.variants).concat(toArray_(media.video_info && media.video_info.variants));
  variants = variants.filter(function(variant) {
    return variant && variant.url && (/mp4/i.test(variant.content_type || "") || /\.mp4(?:$|\?)/i.test(variant.url));
  });
  variants.sort(function(left, right) { return Number(right.bitrate || 0) - Number(left.bitrate || 0); });
  return variants.length ? variants[0].url : "";
}

function mediaResult_(url, isVideo, media) {
  var width = Number(media.width || media.original_info && media.original_info.width || media.size && media.size.width || 0);
  var height = Number(media.height || media.original_info && media.original_info.height || media.size && media.size.height || 0);
  return {
    url: String(url),
    type: isVideo ? "video" : "image",
    isVideo: Boolean(isVideo),
    width: width,
    height: height,
    aspectRatio: width && height ? width / height : 0,
    poster: String(media.thumbnail_url || media.preview_image_url || media.media_url_https || "")
  };
}

function toArray_(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}
