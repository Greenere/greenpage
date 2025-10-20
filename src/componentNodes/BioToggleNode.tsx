import React, { useMemo } from "react";
import { Position } from "@xyflow/react";
import { GreenHandle } from "./Handles";
import { BIOTHEME, type Theme } from "../contents/BioTheme";

interface BioThemeData {
    theme: Theme
    setTheme: (theme: Theme) => void
}

interface BioToggleNodeProps {
    data: BioThemeData,
    isConnectable: boolean
}

const BioToggleNode: React.FC<BioToggleNodeProps> = ({
    data, isConnectable
}) => {
    const randomPos = useMemo(() => { return 30 + Math.random() * 50 }, [])
    return (<>
        <div style={{
            width:"5rem",
            paddingTop:"0.2rem",
            paddingLeft: "0.2rem",
            paddingRight: "0.2rem",
            border: `2px solid var(--color-secondary)`,
            borderRadius: "13px",
        }}>
            <div style={{
                fontSize:"0.5rem"
            }}>
                {BIOTHEME[data.theme].description}
            </div>
            {
                Object.keys(BIOTHEME).map((key) => {
                    return (
                        <div
                            key={key}
                            style={{
                                background: BIOTHEME[key as Theme].keyColor,
                                display: 'inline-block',
                                borderRadius: "50%",
                                width: "1rem",
                                height: "1rem",
                                margin:"0.1rem",
                                border:`2px ${data.theme == key? 'solid':'dotted'} black`
                            }}
                            onClick={() => {
                                data.setTheme(key as unknown as Theme)
                            }}>
                        </div>)
                })
            }
            <GreenHandle
                type="source"
                id="bio-toggle-port"
                position={Position.Bottom}
                style={{
                    left: `${randomPos}%`
                }}
            />
        </div>
    </>)
}

export default BioToggleNode;
