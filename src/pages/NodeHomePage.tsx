import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
import BioNode from '../componentNodes/BioNode';
import { edgeTypes } from '../componentNodes/EdgeTypes';
import StoryNode from '../componentNodes/StoryNode';
import { BlogIntro, EduIntro, ExperienceIntro, ResearchIntro, TravelIntro } from '../contents/Intros';
import BioToggleNode from '../componentNodes/BioToggleNode';
import { applyThemeVars } from '../styles/colors';
import type { Theme } from '../contents/BioTheme';

const nodeTypes = {
    bioNode: BioNode,
    bioToggleNode: BioToggleNode,
    storyNode: StoryNode
};


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
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
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