import React from "react";
import { Position } from "@xyflow/react";
import { GreenHandle } from "./Handles";
import { BIOTHEME, type Theme } from "../content/BioTheme";
import { themes2color } from "../../../shared/styles/colors";

interface BioThemeData {
    theme: Theme
    setTheme: (theme: Theme) => void
}

interface BioToggleNodeProps {
    data: BioThemeData,
    isConnectable: boolean
}

const BioToggleNode: React.FC<BioToggleNodeProps> = ({
    data, isConnectable: _isConnectable
}) => {
    return (<>
        <div style={{
            width:"10rem",
            paddingTop:"0.2rem",
            paddingLeft: "0.2rem",
            paddingRight: "0.2rem",
            border: `2px solid var(--color-secondary)`,
            borderRadius: "13px",
            textAlign:"center"
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
                                background: themes2color[key as Theme].primary,
                                display: 'inline-block',
                                borderRadius: "50%",
                                width: "1rem",
                                height: "1rem",
                                margin:"0.1rem",
                                border:`1px ${data.theme == key? 'solid':'dotted'} var(--color-secondary)`
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
                    left: "50%"
                }}
            />
        </div>
    </>)
}

export default React.memo(BioToggleNode);
