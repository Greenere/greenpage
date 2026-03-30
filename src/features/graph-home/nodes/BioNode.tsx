import React, { useLayoutEffect, useState } from "react";
import { Footnote, Paragraph, Subtitle } from "../../../shared/ui/StyledTextBlocks";
import { Position, useUpdateNodeInternals } from "@xyflow/react";
import { NodeContainer } from "../../../shared/ui/NodeContainer";
import { GreenHandle, sideToPosition, sideToStyle, type DynamicHandle } from "./Handles";
import { type Theme, BIOTHEME } from "../content/BioTheme";

interface BioData {
    theme: Theme
    handles?: DynamicHandle[]
    portraitConnected?: boolean
}

interface BioNodeProps {
    id: string,
    data: BioData,
    isConnectable: boolean
}

const BioNode: React.FC<BioNodeProps> = ({
    id,
    data, isConnectable: _isConnectable
}) => {
    const [focused, setFocused] = useState<boolean>(false);
    const updateNodeInternals = useUpdateNodeInternals();

    useLayoutEffect(() => {
        updateNodeInternals(id);
    }, [data.handles, data.portraitConnected, id, updateNodeInternals]);

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
                        <img src={BIOTHEME[data.theme].imgSrc} style={{
                            width: `96px`,
                            height: `96px`,
                            objectFit: "cover",
                            borderRadius: "50%",
                            border: `2px solid var(--color-secondary)`,
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
