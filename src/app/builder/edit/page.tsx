// src/app/builder/edit/page.tsx — /builder/edit?id=PRJ-…  (customers)   ·   /builder/edit?template=<id>  (owner, needs admin sign-in)
'use client';

import { useEffect, useState } from 'react';
import Editor from '@/components/builder/Editor';
import RecoverScreen from '@/components/builder/RecoverScreen';
import { useProjectRef } from '@/utils/useProjectRef';

export default function EditPage() {
  const ref = useProjectRef();
  const [tpl, setTpl] = useState<string | null | undefined>(undefined);
  useEffect(() => { setTpl(new URLSearchParams(window.location.search).get('template')); }, []);

  if (tpl) return <Editor mode="template" id={tpl} />;
  if (ref === undefined || tpl === undefined) return <div className="min-h-screen bg-zinc-950" />;
  if (ref === 'bad') return <RecoverScreen id={new URLSearchParams(window.location.search).get('id')?.toUpperCase() || ''} target="edit" />;
  return <Editor mode="project" id={ref.id} keyStr={ref.key} />;
}
