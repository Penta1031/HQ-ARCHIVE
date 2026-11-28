"use client";

import { useEffect, useRef } from "react";

// 브라우저/안드로이드 뒤로가기를 앱 내부 화면(탭, 하위 탭, 모달)과 연결한다.
// 화면이 열릴 때 history 항목을 하나 쌓고, 뒤로가기가 오면 가장 위 화면만 닫는다.
// 버튼 등으로 직접 닫으면 쌓아 둔 history 항목을 조용히 되돌린다.
const stack = [];
let ignoredPops = 0;
let pendingBacks = 0;
let flushScheduled = false;
let listening = false;

function handlePopState() {
  if (ignoredPops > 0) { ignoredPops -= 1; return; }
  const entry = stack.pop();
  if (!entry) return;
  entry.popped = true;
  entry.handler.current?.();
}

function flushBacks() {
  flushScheduled = false;
  if (!pendingBacks) return;
  const count = pendingBacks;
  pendingBacks = 0;
  ignoredPops += 1;
  window.history.go(-count);
}

function push(entry) {
  if (!listening) { window.addEventListener("popstate", handlePopState); listening = true; }
  stack.push(entry);
  // 같은 순간에 닫히고 열리는 화면(예: 게임 → 우승 화면)은 history 항목을 재사용한다.
  if (pendingBacks > 0) { pendingBacks -= 1; return; }
  window.history.pushState({ ...(window.history.state || {}), hqBack: true }, "");
}

function remove(entry) {
  const index = stack.indexOf(entry);
  if (index !== -1) stack.splice(index, 1);
  if (entry.popped) return;
  pendingBacks += 1;
  if (!flushScheduled) { flushScheduled = true; window.setTimeout(flushBacks, 0); }
}

export function useBackHandler(active, onBack) {
  const handler = useRef(onBack);
  handler.current = onBack;
  useEffect(() => {
    if (!active) return;
    const entry = { handler, popped: false };
    push(entry);
    return () => remove(entry);
  }, [active]);
}
