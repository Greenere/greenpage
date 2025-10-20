import React, { useMemo, type ReactNode } from "react";
import { Footnote, Paragraph, Subtitle } from "../components/StyledTextBlocks";
import { Handle, Position } from "@xyflow/react";
import { NodeContainer } from "../components/NodeContainer";
import { GreenHandle } from "./Handles";

type HandleData = {
    type: 'source' | 'target',
    id: string,
    pos: 'left' | 'right' | 'top' | 'bottom'
}

interface StoryData {
    title: string,
    content: ReactNode,
    handles: HandleData[]
}

interface StoryNodeProps {
    data: StoryData,
    isConnectable: boolean
}

const StoryNode: React.FC<StoryNodeProps> = ({
    data, isConnectable
}) => {
    const randomPos = useMemo(() => { return 30 + Math.random() * 50 }, [])
    return (<>
        <NodeContainer>
            <div style={{ marginTop: "0.5rem" }}>
                <Subtitle>{data.title}</Subtitle>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
                {data.content}
            </div>
            {data.handles.map((e) => {
                return (
                    <GreenHandle
                        key={e.id}
                        id={e.id}
                        type={e.type}
                        position={
                            e.pos == 'left' ?
                                Position.Left
                                : e.pos == 'right' ?
                                    Position.Right
                                    : e.pos == 'top' ?
                                        Position.Top
                                        : Position.Bottom}
                        style={
                            e.pos == 'left' || e.pos == 'right' ? {
                                top: `${randomPos}%`
                            } : {
                                left: `${randomPos}%`
                            }}
                    />
                )
            })}
        </NodeContainer>
    </>)
}

export default StoryNode;
