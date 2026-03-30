import React, { useState } from "react";
import { Footnote, Paragraph, Subtitle } from "../../../shared/ui/StyledTextBlocks";
import { Position } from "@xyflow/react";
import { NodeContainer } from "../../../shared/ui/NodeContainer";
import { GreenHandle } from "./Handles";
import { type Theme, BIOTHEME } from "../content/BioTheme";

interface BioData {
    theme: Theme
}

interface BioNodeProps {
    data: BioData,
    isConnectable: boolean
}

const BioNode: React.FC<BioNodeProps> = ({
    data, isConnectable: _isConnectable
}) => {
    const [focused, setFocused] = useState<boolean>(false);
    return (<>
        <NodeContainer>
            <div style={{
                paddingTop: "10px"
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
                            width: `50px`,
                            borderRadius: "50%",
                            border: `2px solid var(--color-secondary)`,
                            filter: `saturate(${focused ? 1.1 : 1}) brightness(${focused ? 1.03 : 1})`
                        }} />
                    </a>

                    <GreenHandle
                        type="target"
                        id="portrait-port"
                        position={Position.Right}
                        style={{
                            top: "50%"
                        }}
                    />
                </div>
                <Subtitle>
                    Haoyang Li
                </Subtitle>
                <Paragraph>
                    I am a Software Engineer based in San Francisco Bay Area
                </Paragraph>
                <div style={{ paddingTop: "0.2rem" }}>
                    <Footnote>lihaoyangjingzhou@outlook.com</Footnote>
                </div>
            </div>

            <GreenHandle
                type="target"
                id="research-port"
                position={Position.Left}
                style={{
                    top: "30%"
                }}
            />
            <GreenHandle
                type="target"
                id="education-port"
                position={Position.Left}
                style={{
                    top: "60%"
                }}
            />
            <GreenHandle
                type="target"
                id="blog-port"
                position={Position.Right}
                style={{
                    top: "75%"
                }}
            />
            <GreenHandle
                type="target"
                id="travel-port"
                position={Position.Right}
                style={{
                    top: "50%"
                }}
            />
            <GreenHandle
                type="target"
                id="experience-port"
                position={Position.Bottom}
                style={{
                    left: "50%"
                }}
            />
        </NodeContainer>
    </>)
}

export default BioNode;
