import { normalizeRoomCode } from './sanitize.ts';

export type InviteRoomKind = 'event' | 'cards' | 'blockblast' | 'glass';

export const INVITE_PARAM_KEYS: Record<InviteRoomKind, string> = {
  event: 'eventRoom',
  cards: 'cardsRoom',
  blockblast: 'bbRoom',
  glass: 'glassRoom',
};

/**
 * Builds a clean shareable invite URL containing only the normalized room query param.
 */
export function buildRoomInviteUrl(
  kind: InviteRoomKind,
  rawCode: string,
  originOverride?: string,
  pathnameOverride?: string,
): string {
  const code = normalizeRoomCode(rawCode);
  if (code.length < 4) return '';

  const origin =
    originOverride ??
    (typeof window !== 'undefined' ? window.location.origin : '');
  const pathname =
    pathnameOverride ??
    (typeof window !== 'undefined' ? window.location.pathname : '/');
  if (!origin) return '';

  const paramKey = INVITE_PARAM_KEYS[kind];
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${origin}${cleanPath}?${paramKey}=${encodeURIComponent(code)}`;
}

export function canUseNativeShare(): boolean {
  return (
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  );
}

/**
 * Copies text to clipboard using Clipboard API with a textarea fallback
 * for non-HTTPS LAN environments.
 */
export async function copyTextSafe(text: string): Promise<boolean> {
  if (!text) return false;
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy execCommand fallback
    }
  }

  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export type ShareInviteOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Invokes Web Share API on supported mobile/tablet browsers and gracefully
 * falls back to copying the invite URL on desktop.
 */
export async function shareRoomInvite(params: {
  kind: InviteRoomKind;
  roomCode: string;
  title: string;
  text: string;
}): Promise<ShareInviteOutcome> {
  const url = buildRoomInviteUrl(params.kind, params.roomCode);
  if (!url) return 'failed';

  if (canUseNativeShare()) {
    try {
      await navigator.share({
        title: params.title,
        text: params.text,
        url,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
      // Fall through to clipboard copy if share failed
    }
  }

  const copied = await copyTextSafe(url);
  return copied ? 'copied' : 'failed';
}
