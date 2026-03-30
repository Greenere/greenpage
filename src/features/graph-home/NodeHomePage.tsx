import { useState, useCallback, useRef, useEffect } from 'react';
import {
    ReactFlow,
    type Node,
    type Edge,
    useNodesState,
    useEdgesState,
    useReactFlow,
    type NodeMouseHandler,
    ReactFlowProvider,
    type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import BioNode from './nodes/BioNode';
import { edgeTypes } from './nodes/EdgeTypes';
import StoryNode from './nodes/StoryNode';
import { BlogIntro, EduIntro, ExperienceIntro, ResearchIntro, TravelIntro } from './content/Intros';
import BioToggleNode from './nodes/BioToggleNode';
import { applyThemeVars } from '../../shared/styles/colors';
import type { Theme } from './content/BioTheme';

const nodeTypes = {
    bioNode: BioNode,
    bioToggleNode: BioToggleNode,
    storyNode: StoryNode
};

const half = (n: number) => n / 2;
const sign = (n: number) => (n < 0 ? -1 : n > 0 ? 1 : 1);

function sizeOf(n: Node) {
    const w = (n.measured?.width ?? n.width ?? 220);
    const h = (n.measured?.height ?? n.height ?? 120);
    return { w, h };
}

function mtvSeparateAABB(
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number
): [number, number] {
    const acx = ax + half(aw), acy = ay + half(ah);
    const bcx = bx + half(bw), bcy = by + half(bh);

    const overlapX = half(aw) + half(bw) - Math.abs(acx - bcx);
    const overlapY = half(ah) + half(bh) - Math.abs(acy - bcy);

    if (overlapX <= 0 || overlapY <= 0) return [0, 0]; // no overlap

    if (overlapX < overlapY) {
        const dir = sign(bcx - acx);
        return [dir * overlapX, 0];
    } else {
        const dir = sign(bcy - acy);
        return [0, dir * overlapY];
    }
}


const NodeCanvas: React.FC = () => {
    const [theme, setTheme] = useState<string>('nyc');

    const centerX = window.innerWidth / 2 - 90;
    const centerY = window.innerHeight / 2 - 50;
    const initialNodes: Node[] = [
        {
            id: 'bio',
            type: "bioNode",
            position: { x: centerX, y: centerY },
            data: { theme: theme }
        },
        {
            id: 'biotoggle',
            position: { x: centerX + 100, y: centerY - 50 },
            data: {
                theme: theme,
                setTheme: setTheme
            },
            type: "bioToggleNode"
        },
        {
            id: 'research',
            type: "storyNode",
            position: { x: centerX - 300, y: centerY - 100 },
            data: {
                title: "Research", content: <ResearchIntro />, handles: [
                    {
                        id: 'bio-port',
                        type: 'source',
                        pos: 'right'
                    }
                ]
            }
        },
        {
            id: 'education',
            type: "storyNode",
            position: { x: centerX - 300, y: centerY + 50 },
            data: {
                title: "Education", content: <EduIntro />, handles: [
                    {
                        id: 'bio-port',
                        type: 'source',
                        pos: 'right'
                    }
                ]
            }
        },
        {
            id: 'travel',
            type: "storyNode",
            position: { x: centerX + 300, y: centerY - 100 },
            data: {
                title: "Travel", content: <TravelIntro />, handles: [
                    {
                        id: 'bio-port',
                        type: 'source',
                        pos: 'left'
                    }
                ]
            }
        },
        {
            id: 'blog',
            type: "storyNode",
            position: { x: centerX + 300, y: centerY + 50 },
            data: {
                title: "Blogs", content: <BlogIntro />, handles: [
                    {
                        id: 'bio-port',
                        type: 'source',
                        pos: 'left'
                    }
                ]
            }
        },
        {
            id: 'experience',
            type: "storyNode",
            position: { x: centerX, y: centerY + 200 },
            data: {
                title: "Experiences", content: <ExperienceIntro />, handles: [
                    {
                        id: 'bio-port',
                        type: 'source',
                        pos: 'top'
                    }
                ]
            }
        },
    ];
    const initialEdges: Edge[] = [
        {
            id: "e1",
            source: "biotoggle",
            target: "bio",
            sourceHandle: "bio-toggle-port",
            targetHandle: "portrait-port",
            type: "dotted"
        },
        {
            id: "e2",
            source: "research",
            target: "bio",
            sourceHandle: "bio-port",
            targetHandle: "research-port",
            type: "dotted"
        },
        {
            id: "e3",
            source: "education",
            target: "bio",
            sourceHandle: "bio-port",
            targetHandle: "education-port",
            type: "dotted"
        },
        {
            id: "e4",
            source: "travel",
            target: "bio",
            sourceHandle: "bio-port",
            targetHandle: "travel-port",
            type: "dotted"
        },
        {
            id: "e5",
            source: "blog",
            target: "bio",
            sourceHandle: "bio-port",
            targetHandle: "blog-port",
            type: "dotted"
        },
        {
            id: "e6",
            source: "experience",
            target: "bio",
            sourceHandle: "bio-port",
            targetHandle: "experience-port",
            type: "dotted"
        },
    ];

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, , onEdgesChange] = useEdgesState(initialEdges);
    const { fitView } = useReactFlow();

    const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
        if (node.id == 'biotoggle') {
            return
        }
        fitView({
            nodes: [{ id: node.id }],
            padding: node.id == 'bio' ? 3 : 2,
            duration: 500,
            includeHiddenNodes: false,
        });
    }, [fitView]);

    const onInit = (instance: ReactFlowInstance) => {
        instance.fitView({
            nodes: [{ id: 'bio' }],
            padding: 2,
            duration: 500,
            includeHiddenNodes: false,
        });
    };

    const rafId = useRef<number | null>(null);

    const onNodeDrag = useCallback((_: unknown, dragged: Node) => {
        if (rafId.current) cancelAnimationFrame(rafId.current);

        rafId.current = requestAnimationFrame(() => {
            setNodes((prev) => {
                // Build a mutable position map we can relax on
                const pos = new Map<string, { x: number; y: number; w: number; h: number }>();
                for (const n of prev) {
                    const { w, h } = sizeOf(n);
                    // start from current RF positions
                    pos.set(n.id, { x: n.position.x, y: n.position.y, w, h });
                }
                // Keep the dragged node exactly where the user is dragging
                if (pos.has(dragged.id)) {
                    const p = pos.get(dragged.id)!;
                    p.x = dragged.position.x;
                    p.y = dragged.position.y;
                }

                // Relaxation parameters
                const MAX_ITERS = 5;        // a few sweeps are enough for small graphs
                const DAMPING = 0.6;        // soften pushes to reduce jitter
                const MAX_STEP = 30;        // clamp per-iteration move to avoid teleports

                for (let iter = 0; iter < MAX_ITERS; iter++) {
                    let movedAny = false;

                    // Iterate over all pairs (B against every A), but never move the dragged node
                    for (const [bid, bp] of pos) {
                        if (bid === dragged.id) continue;

                        for (const [aid, ap] of pos) {
                            if (aid === bid) continue;

                            const [dx, dy] = mtvSeparateAABB(ap.x, ap.y, ap.w, ap.h, bp.x, bp.y, bp.w, bp.h);
                            if (dx !== 0 || dy !== 0) {
                                // push B away from A, damped and clamped
                                const nx = bp.x + Math.max(-MAX_STEP, Math.min(MAX_STEP, dx * DAMPING));
                                const ny = bp.y + Math.max(-MAX_STEP, Math.min(MAX_STEP, dy * DAMPING));
                                if (nx !== bp.x || ny !== bp.y) {
                                    bp.x = nx; bp.y = ny;
                                    movedAny = true;
                                }
                            }
                        }
                    }

                    if (!movedAny) break; // early exit if settled
                }

                // Commit relaxed positions back to React Flow
                return prev.map((n) => {
                    const p = pos.get(n.id)!;
                    return n.id === dragged.id
                        ? { ...n, position: { x: dragged.position.x, y: dragged.position.y } }
                        : { ...n, position: { x: p.x, y: p.y } };
                });
            });
        });
    }, [setNodes]);

    const onNodeDragStop = useCallback(() => {
        if (rafId.current) cancelAnimationFrame(rafId.current);
    }, []);

    useEffect(() => {
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === "bio") {
                    return { ...n, data: { ...n.data, theme } };
                }
                if (n.id === "biotoggle") {
                    return { ...n, data: { ...n.data, theme, setTheme } };
                }
                return n;
            })
        );
    }, [theme, setNodes, setTheme]);

    useEffect(() => {
        applyThemeVars(theme as Theme);
    }, [theme]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onInit={onInit}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            panOnDrag
            zoomOnScroll
            proOptions={{ hideAttribution: true }}
        />
    );
}

export default function NodeHomePage() {
    return (
        <div style={{ width: "100vw", height: "100vh", margin: 0, inset: 0 }}>
            <ReactFlowProvider>
                <NodeCanvas />
            </ReactFlowProvider>
        </div>
    );
}
