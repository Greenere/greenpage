import React, { useLayoutEffect } from "react";
import { Footnote, Paragraph, Subtitle } from "../../../shared/ui/StyledTextBlocks";
import { useUpdateNodeInternals } from "@xyflow/react";
import { NodeContainer } from "../../../shared/ui/NodeContainer";
import { GreenHandle, sideToPosition, sideToStyle, type DynamicHandle } from "./Handles";
import type { ContentBlock } from "../content/Nodes";

interface StoryData {
    title: string,
    subtitle?: string,
    summary?: string,
    detail?: ContentBlock[],
    handles?: DynamicHandle[],
    domainTag?: string,
    badges?: string[],
    relationHint?: string,
    variant?: 'anchor' | 'entry' | 'satellite',
    width?: number,
    height?: number,
    layoutMode?: 'card' | 'container',
}

interface StoryNodeProps {
    id: string,
    data: StoryData,
    isConnectable: boolean
}

const StoryNode: React.FC<StoryNodeProps> = ({
    id,
    data, isConnectable: _isConnectable
}) => {
    const variant = data.variant ?? 'entry';
    const layoutMode = data.layoutMode ?? 'card';
    const updateNodeInternals = useUpdateNodeInternals();

    useLayoutEffect(() => {
        updateNodeInternals(id);
    }, [data.handles, id, updateNodeInternals]);

    const containerStyle: React.CSSProperties =
        layoutMode === 'container'
            ? {
                width: `${data.width ?? 440}px`,
                height: `${data.height ?? 320}px`,
                minWidth: `${data.width ?? 440}px`,
                maxWidth: `${data.width ?? 440}px`,
                paddingLeft: "1rem",
                paddingRight: "1rem",
                paddingBottom: "1rem",
                textAlign: "left",
                background: "color-mix(in srgb, var(--color-background) 90%, white 10%)",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.09)",
            }
            : variant === 'anchor'
            ? {
                minWidth: "14rem",
                maxWidth: "14rem",
                paddingLeft: "0.85rem",
                paddingRight: "0.85rem",
                paddingBottom: "1rem",
                background: "color-mix(in srgb, var(--color-background) 92%, white 8%)",
                boxShadow: "0 16px 36px rgba(0, 0, 0, 0.08)",
            }
                : variant === 'satellite'
                ? {
                    minWidth: "10.5rem",
                    maxWidth: "10.5rem",
                    opacity: 0.92,
                    background: "color-mix(in srgb, var(--color-background) 88%, white 12%)",
                }
                : {
                    minWidth: "11rem",
                    maxWidth: "11rem",
                    minHeight: "9.125rem",
                    background: "color-mix(in srgb, var(--color-background) 90%, white 10%)",
                };

    const visibleBlocks = data.detail?.slice(0, layoutMode === 'container' ? 2 : variant === 'anchor' ? 2 : 1) ?? [];

    const renderBlock = (block: ContentBlock, idx: number) => {
        if (block.type === 'text') {
            return <Paragraph key={idx}>{block.text}</Paragraph>;
        }
        if (block.type === 'quote') {
            return (
                <Paragraph key={idx} style={{ fontStyle: "italic", opacity: 0.9 }}>
                    "{block.text}"
                </Paragraph>
            );
        }
        if (block.type === 'list') {
            return (
                <div key={idx} style={{ marginTop: "0.35rem", padding: "0 0.45rem" }}>
                    {block.items.slice(0, 3).map((item) => (
                        <Footnote key={item} style={{ marginTop: "0.15rem" }}>
                            • {item}
                        </Footnote>
                    ))}
                </div>
            );
        }
        if (block.type === 'link') {
            return (
                <Footnote key={idx} style={{ marginTop: "0.35rem" }}>
                    {block.label}
                </Footnote>
            );
        }
        return null;
    };
    return (<>
        <NodeContainer style={containerStyle}>
            <div style={{ marginTop: data.domainTag ? "1.05rem" : "0.55rem" }}>
                {data.domainTag && (
                    <span
                        style={{
                            position: "absolute",
                            top: "0.45rem",
                            left: "50%",
                            transform: "translateX(-50%)",
                            padding: "0.14rem 0.42rem",
                            borderRadius: "0.32rem",
                            border: "1px solid var(--color-secondary)",
                            background: "color-mix(in srgb, var(--color-background) 90%, white 10%)",
                            fontSize: "0.34rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: "var(--color-text)",
                            lineHeight: 1,
                        }}
                    >
                        {data.domainTag}
                    </span>
                )}
                {data.relationHint && (
                    <Footnote style={{
                        marginBottom: "0.35rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        opacity: 0.78,
                    }}>
                        {data.relationHint}
                    </Footnote>
                )}
                <Subtitle>{data.title}</Subtitle>
                {data.subtitle && (
                    <Footnote style={{ marginTop: "0.2rem", opacity: 0.78 }}>
                        {data.subtitle}
                    </Footnote>
                )}
            </div>
            {data.summary && (
                <div style={{ marginTop: "0.45rem" }}>
                    <Paragraph>{data.summary}</Paragraph>
                </div>
            )}
            <div style={{ marginTop: "0.35rem" }}>
                {visibleBlocks.map(renderBlock)}
            </div>
            {layoutMode === 'container' && (
                <Footnote style={{
                    marginTop: "0.75rem",
                    opacity: 0.7,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}>
                    Drag child nodes inside this domain
                </Footnote>
            )}
            {(data.handles ?? []).map((handle) => (
                <GreenHandle
                    key={handle.id}
                    id={handle.id}
                    type={handle.type}
                    position={sideToPosition(handle.side)}
                    hidden={handle.hidden}
                    style={sideToStyle(handle.side, handle.offset)}
                />
            ))}
        </NodeContainer>
    </>)
}

export default React.memo(StoryNode);
