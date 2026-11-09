// src/components/builder/editorApi.ts — the contract the editor shell gives to every panel.
import type { SiteConfig, SectionType } from '@/lib/builder/schema';
import type { FormCtx } from './FieldForm';

export interface EditorApi {
  cfg: SiteConfig;
  assets: Record<string, string>;
  locked: boolean;
  isProject: boolean;
  projectId: string;
  projectKey?: string;
  sel: string | null;
  select: (id: string | null, scroll?: boolean) => void;
  edit: (tag: string, fn: (c: SiteConfig) => void) => void;
  undo: () => void;
  redo: () => void;
  ctx: FormCtx;
  ops: {
    move: (id: string, d: number) => void;
    moveBefore: (id: string, beforeIndex: number) => void;
    toggle: (id: string) => void;
    remove: (id: string) => void;
    duplicate: (id: string) => void;
    add: (type: SectionType, beforeIndex?: number) => void;
  };
  upload: (file: File) => Promise<{ id: string; dataUrl: string; mime: string; data: string }>;
  removeAsset: (id: string) => Promise<void>;
  errors: { m: string; l: number }[];
  clearErrors: () => void;
}
