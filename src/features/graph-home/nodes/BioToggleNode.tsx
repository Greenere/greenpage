import React, { useLayoutEffect } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";
import { GreenHandle, sideToPosition, sideToStyle, type DynamicHandle } from "./Handles";
import { type Theme } from "../content/BioTheme";
import { THEME_CONFIG, THEME_ORDER } from "../../../configs/themes";

interface BioThemeData {
    theme: Theme
    setTheme: (theme: Theme) => void
    handles?: DynamicHandle[]
}

interface BioToggleNodeProps {
    id: string
    data: BioThemeData
}

const BioToggleNode: React.FC<BioToggleNodeProps> = ({
    id,
    data
}) => {
    const updateNodeInternals = useUpdateNodeInternals();

    useLayoutEffect(() => {
        updateNodeInternals(id);
    }, [data.handles, id, updateNodeInternals]);

    return (<>
        <div style={{
            width:"10rem",
            paddingTop:"0.2rem",
            paddingLeft: "0.2rem",
            paddingRight: "0.2rem",
            border: `2px solid var(--color-secondary)`,
            borderRadius: "13px",
            textAlign:"center",
            background: "color-mix(in srgb, var(--color-background) 88%, white 12%)",
            backdropFilter: "blur(6px)"
        }}>
            <div style={{
                fontSize:"0.5rem"
            }}>
                {THEME_CONFIG[data.theme].label}
            </div>
            {
                THEME_ORDER.map((key) => {
                    return (
                        <div
                            key={key}
                            style={{
                                background: THEME_CONFIG[key].colors.primary,
                                display: 'inline-block',
                                borderRadius: "50%",
                                width: "1rem",
                                height: "1rem",
                                margin:"0.1rem",
                                border:`1px ${data.theme === key ? 'solid' : 'dotted'} var(--color-secondary)`
                            }}
                            onClick={() => {
                                data.setTheme(key)
                            }}>
                        </div>)
                })
            }
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
        </div>
    </>)
}

export default React.memo(BioToggleNode);
