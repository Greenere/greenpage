import React from "react";
import { Portrait } from "../components/Portrait";
import { Footnote, Paragraph, Subtitle } from "../components/StyledTextBlocks";
import { Position } from "@xyflow/react";
import { NodeContainer } from "../components/NodeContainer";
import { GreenHandle } from "./Handles";
import { type Theme, BIOTHEME } from "../contents/BioTheme";

interface BioData {
    theme: Theme
}

interface BioNodeProps {
    data: BioData,
    isConnectable: boolean
}

const BioNode: React.FC<BioNodeProps> = ({
    data, isConnectable
}) => {
    console.log(data, isConnectable)
    return (<>
        <NodeContainer>
            <div style={{
                paddingTop: "10px"
            }}>
                <div style={{ position: "relative", display: "inline-block", background: "transparent" }}>
                    <Portrait
                        width={50}
                        portrait={
                            {
                                "imgSrc": BIOTHEME[data.theme].imgSrc,
                                "url": BIOTHEME[data.theme].url
                            }
                        } />

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
