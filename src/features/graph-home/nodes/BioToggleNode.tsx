import React, { useLayoutEffect } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";
import { GreenHandle, sideToPosition, sideToStyle, type DynamicHandle } from "./Handles";
import { type Theme } from "../content/BioTheme";
import ThemePicker from "../ThemePicker";

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
        <div>
            <ThemePicker theme={data.theme} setTheme={data.setTheme} />
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
