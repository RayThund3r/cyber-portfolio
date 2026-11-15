// src/app/admin/(pro)/events/page.tsx — how the site responds to holidays, national days and surprise events.
'use client';
import EventsPanel from '@/components/admin/EventsPanel';
import { PageHead } from '@/components/admin/ui';

export default function AdminEvents() {
  return (
    <div className="space-y-5">
      <PageHead title="World events" icon="bell" sub="The ribbon, effects and assistant greetings that mark holidays and national days, plus your own surprise events." />
      <EventsPanel />
    </div>
  );
}
