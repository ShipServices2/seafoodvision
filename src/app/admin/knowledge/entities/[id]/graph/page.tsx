'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowLeft, Network, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  entity_type: string;
  status: string | null;
  x: number;
  y: number;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  relation_type: string;
}

const TYPE_COLORS: Record<string, string> = {
  species: '#0d9488',
  product: '#f97316',
  market: '#06b6d4',
  certification: '#16a34a',
  packaging: '#ec4899',
  document: '#6366f1',
  usage: '#8b5cf6',
  other: '#64748b',
};

const NODE_RADIUS = 28;

export default function EntityGraphPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const entityId = params?.id as string;
  const svgRef = useRef<SVGSVGElement>(null);

  const [centerEntity, setCenterEntity] = useState<GraphNode | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [fetching, setFetching] = useState(true);
  const [scale, setScale] = useState(1);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [depth] = useState(1);
  const MAX_NODES = 30;

  useEffect(() => {
    if (!loading && !user) { router.replace('/auth?next=/admin/knowledge'); return; }
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) router.replace('/account');
  }, [user, profile, loading, router]);

  const buildGraph = useCallback(async () => {
    if (!profile || !entityId) return;
    setFetching(true);
    const supabase = createClient();

    const { data: center } = await supabase.from('knowledge_entities').select('*').eq('id', entityId).single();
    if (!center) { setFetching(false); return; }

    const { data: relations } = await supabase
      .from('knowledge_relations')
      .select('*')
      .or(`from_entity_id.eq.${entityId},to_entity_id.eq.${entityId}`)
      .limit(MAX_NODES);

    const relatedIds = new Set<string>();
    (relations ?? []).forEach((r) => {
      if (r.from_entity_id !== entityId) relatedIds.add(r.from_entity_id);
      if (r.to_entity_id !== entityId) relatedIds.add(r.to_entity_id);
    });

    const relatedIdsArr = Array.from(relatedIds).slice(0, MAX_NODES - 1);
    let relatedEntities: GraphNode[] = [];

    if (relatedIdsArr.length > 0) {
      const { data: related } = await supabase.from('knowledge_entities').select('*').in('id', relatedIdsArr);
      relatedEntities = (related ?? []).map((e, i) => {
        const angle = (2 * Math.PI * i) / relatedIdsArr.length;
        const radius = 180;
        return {
          id: e.id,
          label: e.label,
          entity_type: e.entity_type,
          status: e.status,
          x: 300 + radius * Math.cos(angle),
          y: 280 + radius * Math.sin(angle),
        };
      });
    }

    const centerNode: GraphNode = { id: center.id, label: center.label, entity_type: center.entity_type, status: center.status, x: 300, y: 280 };
    setCenterEntity(centerNode);
    setNodes([centerNode, ...relatedEntities]);
    setEdges((relations ?? []).map((r) => ({ id: r.id, from: r.from_entity_id, to: r.to_entity_id, relation_type: r.relation_type })));
    setFetching(false);
  }, [profile, entityId]);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  if (loading || fetching) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/admin/knowledge/entities" className="hover:text-teal-600">Entities</Link>
          <span>/</span>
          <Link href={`/admin/knowledge/entities/${entityId}`} className="hover:text-teal-600 truncate max-w-32">{centerEntity?.label ?? entityId.slice(0, 8)}</Link>
          <span>/</span>
          <span className="text-slate-800 font-medium">Graph</span>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
              <Network className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Neighborhood Graph</h1>
              <p className="text-xs text-slate-500">Depth {depth} — max {MAX_NODES} nodes — click a node to view its detail</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setScale((s) => Math.min(s + 0.2, 2))} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <ZoomIn className="w-4 h-4 text-slate-600" />
            </button>
            <button onClick={() => setScale((s) => Math.max(s - 0.2, 0.4))} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <ZoomOut className="w-4 h-4 text-slate-600" />
            </button>
            <button onClick={buildGraph} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <RefreshCw className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: 520 }}>
          {nodes.length <= 1 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Network className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No relations found for this entity</p>
                <p className="text-xs text-slate-400 mt-1">Add relations to see the graph</p>
              </div>
            </div>
          ) : (
            <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 600 560" style={{ transform: `scale(${scale})`, transformOrigin: 'center', transition: 'transform 0.2s' }}>
              {/* Edges */}
              {edges.map((e) => {
                const from = nodeMap.get(e.from);
                const to = nodeMap.get(e.to);
                if (!from || !to) return null;
                return (
                  <g key={e.id}>
                    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray={e.from === entityId || e.to === entityId ? undefined : '4,4'} />
                    <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 4} textAnchor="middle" fontSize="8" fill="#94a3b8" className="select-none">
                      {e.relation_type.replace(/_/g, ' ').slice(0, 20)}
                    </text>
                  </g>
                );
              })}
              {/* Nodes */}
              {nodes.map((n) => {
                const isCenter = n.id === entityId;
                const color = TYPE_COLORS[n.entity_type] ?? '#64748b';
                const isSelected = selectedNode?.id === n.id;
                return (
                  <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedNode(isSelected ? null : n)}>
                    <circle
                      cx={n.x} cy={n.y}
                      r={isCenter ? NODE_RADIUS + 6 : NODE_RADIUS}
                      fill={color}
                      fillOpacity={isCenter ? 1 : 0.85}
                      stroke={isSelected ? '#1e293b' : 'white'}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={isCenter ? "9" : "8"} fill="white" fontWeight="600" className="select-none">
                      {n.label.slice(0, 12)}{n.label.length > 12 ? '…' : ''}
                    </text>
                    <text x={n.x} y={n.y + (isCenter ? NODE_RADIUS + 18 : NODE_RADIUS + 14)} textAnchor="middle" fontSize="7" fill="#64748b" className="select-none">
                      {n.entity_type}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-slate-500">{type}</span>
            </div>
          ))}
        </div>

        {/* Selected node panel */}
        {selectedNode && (
          <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-800">{selectedNode.label}</div>
              <div className="flex gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{selectedNode.entity_type}</span>
                {selectedNode.status && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{selectedNode.status}</span>}
              </div>
            </div>
            <Link href={`/admin/knowledge/entities/${selectedNode.id}`} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
              Open Entity
            </Link>
          </div>
        )}

        <div className="mt-6">
          <Link href={`/admin/knowledge/entities/${entityId}`} className="flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600">
            <ArrowLeft className="w-4 h-4" /> Back to Entity
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
