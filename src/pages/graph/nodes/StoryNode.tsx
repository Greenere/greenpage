import React, { useLayoutEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Footnote, Paragraph, Subtitle } from "../../../shared/ui/StyledTextBlocks";
import { useUpdateNodeInternals } from "@xyflow/react";
import { NodeContainer } from "../../../shared/ui/NodeContainer";
import { GreenHandle, sideToPosition, sideToStyle, type DynamicHandle } from "./Handles";
import { navigateWithViewTransition } from "../../../shared/ui/viewTransitions";
import { UI_COPY } from '../../../configs/ui/uiCopy';
import { DOMAIN_CONFIG } from '../../../configs/content/domains';
import {
    getNodeDetailPath,
    getNodeTransitionName,
    type DomainId,
    type ContentBlock,
    type NodeGalleryImage,
} from "../content/Nodes";

interface StoryData {
    nodeId?: string,
    domain?: DomainId,
    title: string,
    subtitle?: string,
    summary?: string,
    gallery?: NodeGalleryImage[],
    preview?: ContentBlock[],
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
    data: StoryData
}

const DOMAIN_ICONS: Record<DomainId, string> = Object.fromEntries(
    Object.entries(DOMAIN_CONFIG).map(([domain, config]) => [domain, config.cardTag])
) as Record<DomainId, string>;

const StoryNode: React.FC<StoryNodeProps> = ({
    id,
    data
}) => {
    const variant = data.variant ?? 'entry';
    const layoutMode = data.layoutMode ?? 'card';
    const navigate = useNavigate();
    const updateNodeInternals = useUpdateNodeInternals();
    const showDetailLink = layoutMode !== 'container' && Boolean(data.nodeId);
    const transitionName = showDetailLink ? getNodeTransitionName(data.nodeId ?? id) : undefined;

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
                display: "flex",
                flexDirection: "column",
            }
            : variant === 'anchor'
            ? {
                minWidth: "14.5rem",
                maxWidth: "14.5rem",
                minHeight: "12rem",
                paddingLeft: "0.95rem",
                paddingRight: "0.95rem",
                paddingBottom: "1rem",
                background: "color-mix(in srgb, var(--color-background) 92%, white 8%)",
                boxShadow: "0 16px 36px rgba(0, 0, 0, 0.08)",
                display: "flex",
                flexDirection: "column",
            }
                : variant === 'satellite'
                ? {
                    minWidth: "11rem",
                    maxWidth: "11rem",
                    minHeight: "10.25rem",
                    opacity: 0.92,
                    background: "color-mix(in srgb, var(--color-background) 88%, white 12%)",
                    display: "flex",
                    flexDirection: "column",
                }
                : {
                    minWidth: "12.25rem",
                    maxWidth: "12.25rem",
                    minHeight: "11.4rem",
                    paddingLeft: "0.7rem",
                    paddingRight: "0.7rem",
                    background: "color-mix(in srgb, var(--color-background) 90%, white 10%)",
                    display: "flex",
                    flexDirection: "column",
                };

    const visibleBlocks = data.preview?.slice(0, layoutMode === 'container' ? 2 : variant === 'anchor' ? 2 : 1) ?? [];
    const summaryLineClamp = layoutMode === 'container' ? undefined : variant === 'anchor' ? 5 : 4;

    const stopEventPropagation = (event: React.SyntheticEvent) => {
        event.stopPropagation();
    };

    const handleDetailPointerDown = (event: React.PointerEvent<HTMLAnchorElement>) => {
        stopEventPropagation(event);
    };

    const handleOpenDetail = (event: React.MouseEvent<HTMLAnchorElement>) => {
        stopEventPropagation(event);
        event.preventDefault();
        navigateWithViewTransition(() => {
            navigate(getNodeDetailPath(data.nodeId ?? id));
        }, { resetScrollTop: true });
    };

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
        <NodeContainer style={{
            ...containerStyle,
            viewTransitionName: transitionName,
        }}>
            <div style={{ marginTop: data.domain ? "1.05rem" : "0.55rem" }}>
                {data.domain && (
                    <span
                        aria-label={data.domainTag ?? data.domain}
                        title={data.domainTag ?? data.domain}
                        style={{
                            position: "absolute",
                            top: "0.42rem",
                            left: "50%",
                            transform: "translateX(-50%)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.34rem",
                            fontWeight: 600,
                            color: "var(--color-text)",
                            opacity: 0.68,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            lineHeight: 1,
                        }}
                    >
                        {DOMAIN_ICONS[data.domain]}
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
                    <Paragraph style={{
                        display: summaryLineClamp ? "-webkit-box" : "block",
                        WebkitBoxOrient: summaryLineClamp ? "vertical" : undefined,
                        WebkitLineClamp: summaryLineClamp,
                        overflow: summaryLineClamp ? "hidden" : "visible",
                    }}>{data.summary}</Paragraph>
                </div>
            )}
            <div style={{ marginTop: "0.35rem" }}>
                {visibleBlocks.map(renderBlock)}
            </div>
            {showDetailLink && (
                <div
                    className="node-card-detail-shell"
                >
                    <Link
                        to={getNodeDetailPath(data.nodeId ?? id)}
                        className="node-card-detail-link nodrag nopan"
                        onPointerDown={handleDetailPointerDown}
                        onClick={handleOpenDetail}
                        aria-label={UI_COPY.storyNode.openDetailPageAriaLabel(data.title)}
                    >
                        <span>{UI_COPY.storyNode.moreDetails}</span>
                    </Link>
                </div>
            )}
            {layoutMode === 'container' && (
                <Footnote style={{
                    marginTop: "0.75rem",
                    opacity: 0.7,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                }}>
                    {UI_COPY.storyNode.dragChildNodesHint}
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
