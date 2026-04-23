'use client';

export function openPendingWindow() {
  const nextWindow = window.open('about:blank', '_blank');
  if (nextWindow) nextWindow.opener = null;
  return nextWindow;
}

export function navigatePendingWindow(nextWindow: Window | null, href: string) {
  if (nextWindow) {
    nextWindow.location.href = href;
    return;
  }
  window.open(href, '_blank', 'noopener,noreferrer');
}
