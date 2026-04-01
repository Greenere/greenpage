import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Footnote, Paragraph, Subtitle } from "../../../shared/ui/StyledTextBlocks";
import { Position, useUpdateNodeInternals } from "@xyflow/react";
import { NodeContainer } from "../../../shared/ui/NodeContainer";
import { GreenHandle, sideToPosition, sideToStyle, type DynamicHandle } from "./Handles";
import { type Theme, BIOTHEME } from "../content/BioTheme";
import { navigateWithViewTransition } from "../../../shared/ui/viewTransitions";
import { getNodeDetailPath, getNodeTransitionName, resolveAssetUrl } from "../content/Nodes";

interface BioData {
    theme: Theme
    handles?: DynamicHandle[]
    portraitConnected?: boolean
    onResetGraph?: () => void
}

interface BioNodeProps {
    id: string,
    data: BioData
}

const BioNode: React.FC<BioNodeProps> = ({
    id,
    data
}) => {
    const navigate = useNavigate();
    const [focused, setFocused] = useState<boolean>(false);
    const [bioLinkArmed, setBioLinkArmed] = useState(false);
    const [resetArmed, setResetArmed] = useState(false);
    const bioLinkArmTimeoutRef = useRef<number | null>(null);
    const resetArmTimeoutRef = useRef<number | null>(null);
    const updateNodeInternals = useUpdateNodeInternals();

    useLayoutEffect(() => {
        updateNodeInternals(id);
    }, [data.handles, data.portraitConnected, id, updateNodeInternals]);

    useEffect(() => {
        return () => {
            if (bioLinkArmTimeoutRef.current !== null) {
                window.clearTimeout(bioLinkArmTimeoutRef.current);
            }
            if (resetArmTimeoutRef.current !== null) {
                window.clearTimeout(resetArmTimeoutRef.current);
            }
        };
    }, []);

    const armBioLink = useCallback(() => {
        if (bioLinkArmTimeoutRef.current !== null) {
            window.clearTimeout(bioLinkArmTimeoutRef.current);
        }

        bioLinkArmTimeoutRef.current = window.setTimeout(() => {
            setBioLinkArmed(true);
            bioLinkArmTimeoutRef.current = null;
        }, 220);
    }, []);

    const disarmBioLink = useCallback(() => {
        if (bioLinkArmTimeoutRef.current !== null) {
            window.clearTimeout(bioLinkArmTimeoutRef.current);
            bioLinkArmTimeoutRef.current = null;
        }

        setBioLinkArmed(false);
    }, []);

    const armReset = useCallback(() => {
        if (resetArmTimeoutRef.current !== null) {
            window.clearTimeout(resetArmTimeoutRef.current);
        }

        resetArmTimeoutRef.current = window.setTimeout(() => {
            setResetArmed(true);
            resetArmTimeoutRef.current = null;
        }, 220);
    }, []);

    const disarmReset = useCallback(() => {
        if (resetArmTimeoutRef.current !== null) {
            window.clearTimeout(resetArmTimeoutRef.current);
            resetArmTimeoutRef.current = null;
        }

        setResetArmed(false);
    }, []);

    const stopEventPropagation = (event: React.SyntheticEvent) => {
        event.stopPropagation();
    };

    const handleResetPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!resetArmed) {
            return;
        }

        stopEventPropagation(event);
    };

    const handleResetClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!resetArmed || !data.onResetGraph) {
            event.preventDefault();
            return;
        }

        stopEventPropagation(event);
        data.onResetGraph();
        event.currentTarget.blur();
    };

    const handleBioPointerDown = (event: React.PointerEvent<HTMLAnchorElement>) => {
        if (!bioLinkArmed) {
            return;
        }

        stopEventPropagation(event);
    };

    const handleOpenBio = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (!bioLinkArmed) {
            event.preventDefault();
            return;
        }

        stopEventPropagation(event);
        event.preventDefault();
        navigateWithViewTransition(() => {
            navigate(getNodeDetailPath('bio'));
        }, { resetScrollTop: true });
    };

    return (<>
        <NodeContainer
            style={{
                minWidth: "12rem",
                maxWidth: "12rem",
                minHeight: "14rem",
                paddingLeft: "1rem",
                paddingRight: "1rem",
                paddingBottom: "1.25rem",
                background: "color-mix(in srgb, var(--color-background) 90%, white 10%)",
                viewTransitionName: getNodeTransitionName('bio'),
            }}
        >
            <div style={{
                paddingTop: "1.1rem"
            }}>
                <div style={{ position: "relative", display: "inline-block", background: "transparent" }}>
                    <a
                        href={BIOTHEME[data.theme].url}
                        target="_blank"
                        onMouseOver={() => {
                            setFocused(true);
                        }}
                        onMouseLeave={() => {
                            setFocused(false);
                        }}
                    >
                        <img src={resolveAssetUrl(BIOTHEME[data.theme].imgSrc)} style={{
                            width: `96px`,
                            height: `96px`,
                            objectFit: "cover",
                            borderRadius: "50%",
                            border: `calc(var(--greenpage-bio-portrait-border-width, 1.35) * 1px) solid color-mix(in srgb, var(--color-secondary) calc(var(--greenpage-bio-portrait-border-opacity, 1) * 100%), transparent)`,
                            filter: `saturate(${focused ? 1.08 : 1}) brightness(${focused ? 1.03 : 1})`
                        }} />
                    </a>

                    <GreenHandle
                        type="target"
                        id="portrait-port"
                        position={Position.Right}
                        hidden={!data.portraitConnected}
                        style={{
                            top: "50%"
                        }}
                    />
                </div>
                <div style={{ marginTop: "0.7rem" }}>
                    <Subtitle>
                        Haoyang Li
                    </Subtitle>
                </div>
                <Paragraph style={{
                    marginTop: "0.5rem",
                    fontSize: "0.54rem",
                    lineHeight: 1.16,
                    textAlign: "center",
                    textJustify: "auto",
                }}>
                    I am a Software Engineer based in San Francisco Bay Area
                </Paragraph>
                <div style={{ paddingTop: "0.35rem" }}>
                    <Footnote style={{ opacity: 0.84 }}>lihaoyangjingzhou@outlook.com</Footnote>
                </div>
            </div>
            <div
                className="node-card-detail-shell"
                style={{ gap: "0.9rem" }}
            >
                <div
                    onPointerEnter={armBioLink}
                    onPointerLeave={disarmBioLink}
                >
                    <Link
                        to={getNodeDetailPath('bio')}
                        className={`node-card-detail-link ${bioLinkArmed ? 'nodrag nopan' : ''}`.trim()}
                        onPointerDown={handleBioPointerDown}
                        onClick={handleOpenBio}
                        onFocus={armBioLink}
                        onBlur={disarmBioLink}
                        aria-label="Open the bio detail page"
                    >
                        <span>about me</span>
                    </Link>
                </div>
                <div
                    onPointerEnter={armReset}
                    onPointerLeave={disarmReset}
                >
                    <button
                        type="button"
                        className={`node-card-detail-link ${resetArmed ? 'nodrag nopan' : ''}`.trim()}
                        onPointerDown={handleResetPointerDown}
                        onClick={handleResetClick}
                        onFocus={armReset}
                        onBlur={disarmReset}
                        aria-label="Reset graph layout"
                        style={{
                            background: "transparent",
                            border: "none",
                        }}
                    >
                        <span>reset</span>
                    </button>
                </div>
            </div>

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

export default React.memo(BioNode);
