// src/components/chat/useAttachments.ts
//
// Holds the files a visitor shares with the chat.
//   pending : chosen but not yet sent (shown as chips above the input)
//   shared  : already sent in this conversation — the assistant can still answer questions about
//             them, and they can be forwarded to the owner on request
// Every file is checked and read in the browser with the same rules the server re-checks.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ATTACH, formatBytes } from '@/lib/attachmentRules';
import { analyzeFile } from '@/utils/chatEngine/fileInsights';
import type { FileInsight } from '@/utils/chatEngine/types';

export interface SharedFile {
  insight: FileInsight;
  file: File;
  /** Blob URL for image thumbnails (this tab only). */
  previewUrl?: string;
}

export function useAttachments() {
  const [pending, setPending] = useState<SharedFile[]>([]);
  const [shared, setShared] = useState<SharedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const urls = useRef<Set<string>>(new Set());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const epoch = useRef(0);
  const latest = useRef({ pending, shared });
  latest.current = { pending, shared };

  // Free every blob URL when the chat goes away.
  useEffect(() => {
    const set = urls.current;
    return () => {
      set.forEach((u) => URL.revokeObjectURL(u));
      set.clear();
    };
  }, []);

  // Calls are run one after another so quick successive picks/drops can't slip past the limits.
  const add = useCallback((list: FileList | File[] | null): Promise<void> => {
    const incoming = list ? Array.from(list) : [];
    if (!incoming.length) return Promise.resolve();
    const run = queue.current.then(() => addNow(incoming));
    queue.current = run.catch(() => {});
    return run;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addNow = async (incoming: File[]) => {
    const myEpoch = epoch.current;
    setError(null);
    setBusy(true);
    const problems: string[] = [];
    const added: SharedFile[] = [];
    try {
      for (const file of incoming) {
        const { pending: p, shared: s } = latest.current;
        const count = p.length + s.length + added.length;
        if (count >= ATTACH.maxFiles) {
          problems.push(`You can share up to ${ATTACH.maxFiles} files in one chat.`);
          break;
        }
        const total = [...p, ...s, ...added].reduce((n, f) => n + f.file.size, 0) + file.size;
        if (total > ATTACH.maxTotalBytes) {
          problems.push(`That would be more than ${formatBytes(ATTACH.maxTotalBytes)} in total.`);
          continue;
        }
        try {
          const insight = await analyzeFile(file);
          let previewUrl: string | undefined;
          if (insight.kind === 'image') {
            previewUrl = URL.createObjectURL(file);
            urls.current.add(previewUrl);
          }
          added.push({ insight, file, previewUrl });
        } catch (e) {
          problems.push(e instanceof Error ? e.message : `Couldn't read "${file.name}".`);
        }
      }
      if (myEpoch !== epoch.current) {
        // The chat was reset while we were reading: drop what we read.
        added.forEach((f) => {
          if (f.previewUrl) {
            URL.revokeObjectURL(f.previewUrl);
            urls.current.delete(f.previewUrl);
          }
        });
        return;
      }
      if (added.length) {
        latest.current = { ...latest.current, pending: [...latest.current.pending, ...added] };
        setPending((prev) => [...prev, ...added]);
      }
      if (problems.length) setError(Array.from(new Set(problems)).join(' '));
    } finally {
      if (myEpoch === epoch.current) setBusy(false);
    }
  };

  const removePending = useCallback((id: string) => {
    setPending((prev) => {
      const hit = prev.find((f) => f.insight.id === id);
      if (hit?.previewUrl) {
        URL.revokeObjectURL(hit.previewUrl);
        urls.current.delete(hit.previewUrl);
      }
      return prev.filter((f) => f.insight.id !== id);
    });
  }, []);

  /** Move pending files into the conversation; returns what was moved. */
  const commit = useCallback((): SharedFile[] => {
    const moved = latest.current.pending;
    if (moved.length) {
      setShared((prev) => [...prev, ...moved]);
      setPending([]);
    }
    return moved;
  }, []);

  const clearAll = useCallback(() => {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current.clear();
    epoch.current++;
    setBusy(false);
    setPending([]);
    setShared([]);
    setError(null);
  }, []);

  return { pending, shared, error, busy, add, removePending, commit, clearAll, clearError: () => setError(null) };
}
