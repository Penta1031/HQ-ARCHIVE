// HQ ARCHIVE 빠른 읽기 패치
// 현재 Code.gs의 doPost(e)에서 SpreadsheetApp.openById(...) 다음에 아래 블록을 추가하세요.
//
// var optimizedRead = handleOptimizedRead_(action, requestData, ss);
// if (optimizedRead) return createJsonResponse(optimizedRead);

function handleOptimizedRead_(action, requestData, ss) {
  var sheet = ss.getSheetByName(MAIN_SHEET_NAME);
  if (action === "getMainPage") return getMainPage_(sheet, requestData);
  if (action === "getCalendarData") return getCalendarData_(sheet, requestData);
  if (action === "getTodayData") return getTodayData_(sheet, requestData);
  return null;
}

function getMainPage_(sheet, requestData) {
  var page = Math.max(1, Number(requestData.page) || 1);
  var limit = Math.min(60, Math.max(1, Number(requestData.limit) || 30));
  var query = String(requestData.query || "").replace(/^#/, "").trim().toLowerCase();
  var mainCategory = String(requestData.mainCategory || "전체");
  var subCategory = String(requestData.subCategory || "전체");
  var sortOrder = requestData.sortOrder === "asc" ? "asc" : "desc";
  var lastRow = sheet.getLastRow();
  var totalRows = Math.max(0, lastRow - 1);

  // 시트는 서버 내부에서 한 번에 읽고 날짜순으로 정렬합니다.
  // 브라우저에는 현재 페이지 30개만 전송하여 기존 전체 전송 병목을 없앩니다.
  if (!query && mainCategory === "전체" && subCategory === "전체") {
    var cache = CacheService.getScriptCache();
    var cacheKey = "hq-main-page-" + page + "-" + limit + "-" + sortOrder;
    var cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
    var startOffset = (page - 1) * limit;
    if (startOffset >= totalRows) return { status: "success", data: [], total: totalRows, page: page, hasMore: false };
    var rows = sheet.getRange(2, 1, totalRows, 8).getDisplayValues();
    rows.sort(function(a, b) { var compared = String(a[1]).localeCompare(String(b[1])); return sortOrder === "asc" ? compared : -compared; });
    var selected = rows.slice(startOffset, startOffset + limit);
    var response = { status: "success", data: selected, total: totalRows, page: page, hasMore: startOffset + selected.length < totalRows };
    cache.put(cacheKey, JSON.stringify(response), 120);
    return response;
  }

  // 검색·필터는 서버에서 처리하고 현재 페이지 30개만 전송합니다.
  var values = totalRows ? sheet.getRange(2, 1, totalRows, 8).getDisplayValues() : [];
  var filtered = values.filter(function(row) {
    var text = row.join(" ").toLowerCase();
    return (!query || text.indexOf(query) !== -1) &&
      (mainCategory === "전체" || row[4] === mainCategory) &&
      (subCategory === "전체" || row[5] === subCategory);
  });
  filtered.sort(function(a, b) { return sortOrder === "asc" ? String(a[1]).localeCompare(String(b[1])) : String(b[1]).localeCompare(String(a[1])); });
  var start = (page - 1) * limit;
  return { status: "success", data: filtered.slice(start, start + limit), total: filtered.length, page: page, hasMore: start + limit < filtered.length };
}

function clearArchivePageCache_() {
  var keys = [];
  ["asc", "desc"].forEach(function(sortOrder) {
    for (var page = 1; page <= 20; page++) keys.push("hq-main-page-" + page + "-30-" + sortOrder);
  });
  CacheService.getScriptCache().removeAll(keys);
}

function getCalendarData_(sheet, requestData) {
  var monthKey = String(requestData.year) + "-" + String(requestData.month).padStart(2, "0");
  var lastRow = sheet.getLastRow();
  var totalRows = Math.max(0, lastRow - 1);
  if (!totalRows) return { status: "success", data: [], total: 0 };

  // 날짜 1열만 먼저 읽고, 해당 월의 연속 범위만 8열로 가져옵니다.
  var dates = sheet.getRange(2, 2, totalRows, 1).getDisplayValues();
  var matchedRows = [];
  dates.forEach(function(value, index) { if (String(value[0]).indexOf(monthKey) === 0) matchedRows.push(index + 2); });
  if (!matchedRows.length) return { status: "success", data: [], total: 0 };
  var first = matchedRows[0];
  var last = matchedRows[matchedRows.length - 1];
  var data = sheet.getRange(first, 1, last - first + 1, 8).getDisplayValues().filter(function(row) { return String(row[1]).indexOf(monthKey) === 0; });
  data.sort(function(a, b) { return String(b[1]).localeCompare(String(a[1])); });
  return { status: "success", data: data, total: data.length };
}

function getTodayData_(sheet, requestData) {
  var monthDay = String(requestData.monthDay || "");
  var lastRow = sheet.getLastRow();
  var totalRows = Math.max(0, lastRow - 1);
  if (!totalRows || !/^\d{2}-\d{2}$/.test(monthDay)) return { status: "success", data: [], total: 0 };
  var values = sheet.getRange(2, 1, totalRows, 8).getDisplayValues();
  var data = values.filter(function(row) { return String(row[1]).slice(5) === monthDay; });
  data.sort(function(a, b) { return String(b[1]).localeCompare(String(a[1])); });
  return { status: "success", data: data, total: data.length };
}
