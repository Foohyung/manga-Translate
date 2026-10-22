'use client';

import { useActivePage, useProjectStore, type PanelTab } from '@/store/project-store';
import { GlossaryPanel } from './GlossaryPanel';
import { LayerInspector } from './LayerInspector';
import { LayerList } from './LayerList';

export function SidePanel() {
  const tab = useProjectStore((state) => state.panelTab);
  const setTab = useProjectStore((state) => state.setPanelTab);
  const layerCount = useActivePage()?.layers.length ?? 0;

  const tabs: { id: PanelTab; label: string }[] = [
    { id: 'texts', label: `ข้อความ (${layerCount})` },
    { id: 'style', label: 'ปรับแต่ง' },
    { id: 'glossary', label: 'คำศัพท์' },
  ];

  return (
    <aside className="flex min-h-0 flex-col border-t border-border lg:w-[22rem] lg:shrink-0 lg:border-t-0 lg:border-l">
      <div role="tablist" aria-label="แผงข้อความ" className="flex border-b border-border">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            id={`panel-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className={`flex-1 border-b-2 px-4 py-3 text-sm font-medium transition ${
              tab === id ? 'border-primary text-foreground' : 'border-transparent text-muted hover:text-foreground'
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {/* All panels stay mounted so the inspector can focus its text field on request. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div id="panel-texts" role="tabpanel" aria-labelledby="panel-tab-texts" hidden={tab !== 'texts'}>
          <LayerList />
        </div>
        <div id="panel-style" role="tabpanel" aria-labelledby="panel-tab-style" hidden={tab !== 'style'}>
          <LayerInspector />
        </div>
        <div id="panel-glossary" role="tabpanel" aria-labelledby="panel-tab-glossary" hidden={tab !== 'glossary'}>
          <GlossaryPanel />
        </div>
      </div>
    </aside>
  );
}
