// src/components/chat/useAttachments.ts
//
// Holds the files a visitor shares with the chat.
//   pending : chosen but not yet sent (shown as chips above the input)
//   shared  : already sent in this conversation — the assistant can still answer questions about
//             them, and they can be forwarded to the owner on request
// Every file is checked and read in the browser with the same rules the server re-checks.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ATTACH, formatBytes, kindOfName } from '@/lib/attachmentRules';
import { SHRINK, shrinkImage } from '@/lib/imageTools';
import { analyzeFile } from '@/utils/chatEngine/fileInsights';
import { ocrMode, readImageText } from '@/lib/ocr';
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
  const [status, setStatus] = useState<string | null>(null);
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
      for (const original of incoming) {
        let file = original;
        let note: string | undefined;
        if (kindOfName(original.name) === 'image' && original.size > SHRINK.maxInputBytes) {
          problems.push(`"${original.name}" is too large (max ${formatBytes(SHRINK.maxInputBytes)}).`);
          continue;
        }
        if (kindOfName(original.name) === 'image') {
          setStatus('Optimising photo…');
          const sh = await shrinkImage(original);
          file = sh.file;
          note = sh.note;
          setStatus(null);
        }
        const { pending: p, shared: s } = latest.current;
        const count = p.length + s.length + added.length;
        if (count >= ATTACH.maxReadFiles) {
          problems.push(`You can share up to ${ATTACH.maxReadFiles} files in one chat.`);
          break;
        }
        const total = [...p, ...s, ...added].reduce((n, f) => n + f.file.size, 0) + file.size;
        if (total > ATTACH.maxReadTotalBytes) {
          problems.push(`That would be more than ${formatBytes(ATTACH.maxReadTotalBytes)} in total.`);
          continue;
        }
        try {
          setStatus('Reading file…');
          const insight = await analyzeFile(file);
          if (note) insight.note = note;
          // Where the browser can read text in pictures instantly and for free (no download), do it straight away so the assistant can answer about screenshots.
          if (insight.kind === 'image' && ocrMode() === 'native') {
            try { const t = await readImageText(file, setStatus); if (t) { insight.text = t; insight.excerpt = t.slice(0, 3000); insight.summary += ' · text read'; } } catch { /* the "Read text" button is still there */ }
          }
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
      setStatus(null);
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

  /** Read the text inside a picture (on request). The result is stored on the file so the assistant can use it. */
  const readText = useCallback(async (id: string) => {
    const hit = [...latest.current.pending, ...latest.current.shared].find((f) => f.insight.id === id);
    if (!hit || hit.insight.kind !== 'image') return;
    setBusy(true);
    setError(null);
    try {
      const text = await readImageText(hit.file, setStatus);
      const patch = (list: SharedFile[]) => list.map((f) => (f.insight.id === id ? { ...f, insight: { ...f.insight, ...(text ? { text, excerpt: text.slice(0, 3000), summary: `${f.insight.summary} · text read (${(text.match(/\S+/g) || []).length} words)` } : { note: 'No readable text was found in this picture' }) } } : f));
      setPending(patch);
      setShared(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the text in that picture.');
    } finally {
      setStatus(null);
      setBusy(false);
    }
  }, []);

  /** Forget one file that was already shared (the assistant stops using it). */
  const removeShared = useCallback((id: string) => {
    setShared((prev) => {
      const hit = prev.find((f) => f.insight.id === id);
      if (hit?.previewUrl) { /* the message bubble may still show it, so the blob URL is kept until the chat closes */ }
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

  return { pending, shared, error, busy, status, add, removePending, removeShared, readText, commit, clearAll, clearError: () => setError(null) };
}
