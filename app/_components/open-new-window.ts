'use client';

export function openPendingWindow(): Window | null {
  return null;
}

export function navigatePendingWindow(nextWindow: Window | null, href: string) {
  if (nextWindow) {
    nextWindow.location.href = href;
    return;
  }
  window.location.href = href;
}
