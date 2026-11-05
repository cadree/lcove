import { useEffect } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

let users = 0;
let stop: (() => void) | undefined;

/** One set of listeners shared by all dialogs/sheets, including nested overlays. */
export function useOverlayViewport() {
  useEffect(() => {
    if (users++ === 0) stop = observeViewport();
    return () => { if (--users === 0) { stop?.(); stop = undefined; } };
  }, []);
}

function observeViewport() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let fullHeight = window.innerHeight;
  let keyboard = 0;
  let frame = 0;
  let disposed = false;
  const handles: PluginListenerHandle[] = [];
  const update = () => {
    if (!keyboard) fullHeight = window.innerHeight;
    const top = viewport?.offsetTop ?? 0;
    // min prevents subtracting the keyboard twice when the webview already resized.
    const height = Math.max(0, Math.min(viewport?.height ?? window.innerHeight, fullHeight - keyboard));
    root.style.setProperty('--overlay-height', `${height}px`);
    root.style.setProperty('--overlay-top', `${top}px`);
    root.style.setProperty('--keyboard-height', `${Math.max(keyboard, fullHeight - height - top, 0)}px`);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.matches('input, textarea, select, [contenteditable="true"]') && focused.closest('[role="dialog"]')) {
        const rect = focused.getBoundingClientRect();
        if (rect.bottom > top + height - 32 || rect.top < top + 32) focused.scrollIntoView({ block: 'nearest' });
      }
    });
  };
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  document.addEventListener('focusin', update);
  if (Capacitor.isNativePlatform()) {
    const listen = async () => {
      const show = await Keyboard.addListener('keyboardWillShow', info => {
        if (!keyboard) fullHeight = window.innerHeight;
        keyboard = info.keyboardHeight;
        update();
      });
      if (disposed) void show.remove(); else handles.push(show);
      const hide = await Keyboard.addListener('keyboardWillHide', () => { keyboard = 0; update(); });
      if (disposed) void hide.remove(); else handles.push(hide);
    };
    void listen().catch(() => { /* visualViewport remains available on webviews without the plugin. */ });
  }
  update();
  return () => {
    disposed = true;
    handles.forEach(handle => { void handle.remove(); });
    cancelAnimationFrame(frame);
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    document.removeEventListener('focusin', update);
    ['--overlay-height', '--overlay-top', '--keyboard-height'].forEach(name => root.style.removeProperty(name));
  };
}
