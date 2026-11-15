// src/app/admin/(pro)/games/page.tsx — add, edit and embed links to web games you built.
'use client';
import GamesPanel from '@/components/admin/GamesPanel';
import { PageHead } from '@/components/admin/ui';

export default function AdminGames() {
  return (
    <div className="space-y-5">
      <PageHead title="Games" icon="gamepad" sub="Add links to web games you made. They show on the public Games page and play right there." />
      <GamesPanel />
    </div>
  );
}
