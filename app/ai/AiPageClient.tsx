'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AiAssistantClient from './AiAssistantClient';

const MESSAGE_TYPE_AUTH_TOKEN = 'AUTH_TOKEN';
const MESSAGE_TYPE_REQUEST_AUTH_TOKEN = 'REQUEST_AUTH_TOKEN';

type ParentEventData = {
  type?: string;
  token?: string;
};

function parseTrustedOrigins(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getReferrerOrigin(): string | null {
  if (typeof document === 'undefined' || !document.referrer) {
    return null;
  }

  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

export default function AiPageClient() {
  const [runtimeToken, setRuntimeToken] = useState<string>('');
  const runtimeTokenRef = useRef('');

  useEffect(() => {
    runtimeTokenRef.current = runtimeToken;
  }, [runtimeToken]);

  const trustedParentOrigins = useMemo(
    () => parseTrustedOrigins(process.env.NEXT_PUBLIC_ALLOWED_PARENT_ORIGINS),
    [],
  );

  const acceptedParentOrigins = useMemo(() => {
    if (trustedParentOrigins.length > 0) {
      return trustedParentOrigins;
    }

    const referrerOrigin = getReferrerOrigin();
    return referrerOrigin ? [referrerOrigin] : [];
  }, [trustedParentOrigins]);

  const allowDirectParentFallback = acceptedParentOrigins.length === 0;

  const requestTokenFromParent = useCallback(() => {
    if (typeof window === 'undefined' || window.parent === window) {
      return;
    }

    const message = {
      type: MESSAGE_TYPE_REQUEST_AUTH_TOKEN,
      source: 'oph-agent-next',
      timestamp: Date.now(),
    };

    if (acceptedParentOrigins.length === 0) {
      window.parent.postMessage(message, '*');
      return;
    }

    acceptedParentOrigins.forEach((origin) => {
      window.parent.postMessage(message, origin);
    });
  }, [acceptedParentOrigins]);

  const ensureToken = useCallback(async () => {
    const currentToken = runtimeToken.trim();
    if (currentToken) {
      return currentToken;
    }

    if (typeof window === 'undefined' || window.parent === window) {
      return '';
    }

    requestTokenFromParent();
    return '';
  }, [requestTokenFromParent, runtimeToken]);

  useEffect(() => {
    function handleParentMessage(event: MessageEvent<ParentEventData>) {
      if (typeof window === 'undefined' || event.source !== window.parent) {
        return;
      }

      const isFromDirectParent = event.source === window.parent;
      const isTrustedOrigin =
        acceptedParentOrigins.includes(event.origin) ||
        event.origin === window.location.origin ||
        (allowDirectParentFallback && isFromDirectParent);

      if (!isTrustedOrigin || event.data?.type !== MESSAGE_TYPE_AUTH_TOKEN) {
        return;
      }

      const nextToken = event.data.token?.trim() || '';
      if (!nextToken) {
        return;
      }

      setRuntimeToken((prev) => (prev === nextToken ? prev : nextToken));
    }

    window.addEventListener('message', handleParentMessage);
    requestTokenFromParent();

    const retryTimer = window.setTimeout(() => {
      if (!runtimeTokenRef.current.trim()) {
        requestTokenFromParent();
      }
    }, 300);

    return () => {
      window.removeEventListener('message', handleParentMessage);
      window.clearTimeout(retryTimer);
    };
  }, [
    acceptedParentOrigins,
    allowDirectParentFallback,
    requestTokenFromParent,
  ]);

  return <AiAssistantClient token={runtimeToken} ensureToken={ensureToken} />;
}
