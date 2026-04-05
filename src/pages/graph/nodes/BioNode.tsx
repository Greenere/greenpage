import React, { useEffect, useLayoutEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Footnote, Paragraph, Subtitle } from "../../../shared/ui/StyledTextBlocks";
import { Position, useUpdateNodeInternals } from "@xyflow/react";
import { NodeContainer } from "../../../shared/ui/NodeContainer";
import { GreenHandle, sideToPosition, sideToStyle, type DynamicHandle } from "./Handles";
import { type Theme, BIOTHEME } from "../content/BioTheme";
import { getBioPortraitHref, loadBioPageContent, readCachedBioPageContent, type BioPageContent } from "../content/BioPage";
import { navigateWithViewTransition } from "../../../shared/ui/viewTransitions";
import { UI_COPY } from '../../../configs/ui/uiCopy';
import { getNodeDetailPath, resolveAssetUrl } from "../content/Nodes";
import { useAppLanguage } from '../../../i18n/useAppLanguage';
import { isExternalHref, isInternalHref } from '../DetailContent';

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
    const { language } = useAppLanguage();
    const [focused, setFocused] = useState<boolean>(false);
    const [bioContent, setBioContent] = useState<BioPageContent | null>(() => readCachedBioPageContent(language));
    const updateNodeInternals = useUpdateNodeInternals();
    const portraitHref = getBioPortraitHref(bioContent ?? {});
    const portraitUsesInternalNavigation = portraitHref ? isInternalHref(portraitHref) : false;
    const portraitUsesExternalNavigation = portraitHref ? isExternalHref(portraitHref) : false;

    useLayoutEffect(() => {
        updateNodeInternals(id);
    }, [data.handles, data.portraitConnected, id, updateNodeInternals]);

    useEffect(() => {
        let cancelled = false;
        const cachedContent = readCachedBioPageContent(language);
        setBioContent(cachedContent);

        if (cachedContent) {
            return () => {
                cancelled = true;
            };
        }

        loadBioPageContent(language)
            .then((content) => {
                if (!cancelled) {
                    setBioContent(content);
                }
            })
            .catch(() => {
                // Keep the bio card usable even if the bio payload fails to load.
            });

        return () => {
            cancelled = true;
        };
    }, [language]);

    const bioName = bioContent?.name ?? UI_COPY.bioNode.fallbackName;
    const bioSubtitle = bioContent?.subtitle ?? UI_COPY.bioNode.fallbackSubtitle;
    const bioContact =
        bioContent?.facts?.find((fact) => fact.href?.startsWith("mailto:") || fact.value.includes("@"))?.value ??
        UI_COPY.bioNode.fallbackContact;

    const stopEventPropagation = (event: React.SyntheticEvent) => {
        event.stopPropagation();
    };

    const handleResetPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
        stopEventPropagation(event);
    };

    const handleResetClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!data.onResetGraph) {
            event.preventDefault();
            return;
        }

        stopEventPropagation(event);
        data.onResetGraph();
        event.currentTarget.blur();
    };

    const handleBioPointerDown = (event: React.PointerEvent<HTMLAnchorElement>) => {
        stopEventPropagation(event);
    };

    const handlePortraitClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        stopEventPropagation(event);

        if (!portraitHref || !portraitUsesInternalNavigation) {
            return;
        }

        event.preventDefault();
        navigateWithViewTransition(() => {
            navigate(portraitHref);
        }, { resetScrollTop: portraitHref.startsWith('/nodes/') });
    };

    const portraitImage = (
        <img src={resolveAssetUrl(BIOTHEME[data.theme].imgSrc)} style={{
            width: `96px`,
            height: `96px`,
            objectFit: "cover",
            borderRadius: "50%",
            border: `calc(var(--greenpage-bio-portrait-border-width, 1.35) * 1px) solid color-mix(in srgb, var(--color-secondary) calc(var(--greenpage-bio-portrait-border-opacity, 1) * 100%), transparent)`,
            filter: `saturate(${focused ? 1.08 : 1}) brightness(${focused ? 1.03 : 1})`,
        }} />
    );

    const handleOpenBio = (event: React.MouseEvent<HTMLAnchorElement>) => {
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
            }}
        >
            <div style={{
                paddingTop: "1.1rem"
            }}>
                <div style={{ position: "relative", display: "inline-block", background: "transparent" }}>
                    {portraitHref ? (
                        <a
                            href={portraitHref}
                            target={portraitUsesExternalNavigation ? "_blank" : undefined}
                            rel={portraitUsesExternalNavigation ? "noreferrer" : undefined}
                            onPointerDown={handleBioPointerDown}
                            onClick={handlePortraitClick}
                            onMouseOver={() => {
                                setFocused(true);
                            }}
                            onMouseLeave={() => {
                                setFocused(false);
                            }}
                        >
                            {portraitImage}
                        </a>
                    ) : (
                        portraitImage
                    )}

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
                        {bioName}
                    </Subtitle>
                </div>
                <Paragraph style={{
                    marginTop: "0.5rem",
                    fontSize: "0.54rem",
                    lineHeight: 1.16,
                    textAlign: "center",
                    textJustify: "auto",
                }}>
                    {bioSubtitle}
                </Paragraph>
                <div style={{ paddingTop: "0.35rem" }}>
                    <Footnote style={{ opacity: 0.84 }}>{bioContact}</Footnote>
                </div>
            </div>
            <div
                className="node-card-detail-shell"
                style={{ gap: "0.9rem" }}
            >
                <div>
                    <Link
                        to={getNodeDetailPath('bio')}
                        className="node-card-detail-link nodrag nopan"
                        onPointerDown={handleBioPointerDown}
                        onClick={handleOpenBio}
                        aria-label={UI_COPY.bioNode.openBioDetailPageAriaLabel}
                    >
                        <span>{UI_COPY.bioNode.aboutMe}</span>
                    </Link>
                </div>
                <div>
                    <button
                        type="button"
                        className="node-card-detail-link nodrag nopan"
                        onPointerDown={handleResetPointerDown}
                        onClick={handleResetClick}
                        aria-label={UI_COPY.bioNode.resetGraphLayoutAriaLabel}
                        style={{
                            background: "transparent",
                            border: "none",
                        }}
                    >
                        <span>{UI_COPY.bioNode.reset}</span>
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
