// src/lib/builder/readiness.ts — friendly pre-purchase checks (kept separate to avoid an import cycle schema ⇄ pro).
import { classicWarnings, type SiteConfig } from './schema';
import { proWarnings } from './pro';

export const readinessWarnings = (cfg: SiteConfig): string[] => (cfg.kind === 'pro' && cfg.pro ? proWarnings(cfg) : classicWarnings(cfg));
