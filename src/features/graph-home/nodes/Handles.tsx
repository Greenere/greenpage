import { Handle, Position } from "@xyflow/react"

export type HandleSide = 'left' | 'right' | 'top' | 'bottom'

export type DynamicHandle = {
    id: string
    type: 'source' | 'target'
    side: HandleSide
    offset: number
    hidden?: boolean
}

interface GreenHandleProps {
    type: 'source' | 'target'
    id: string
    position: Position
    style?: Record<string, unknown>
    isConnectable?: boolean
    hidden?: boolean
}

function clampOffset(offset: number) {
    return Math.max(0.08, Math.min(0.92, offset));
}

function sideToPosition(side: HandleSide) {
    if (side === 'left') return Position.Left;
    if (side === 'right') return Position.Right;
    if (side === 'top') return Position.Top;
    return Position.Bottom;
}

function sideToStyle(side: HandleSide, offset: number) {
    const normalized = `${clampOffset(offset) * 100}%`;
    if (side === 'left' || side === 'right') {
        return { top: normalized };
    }
    return { left: normalized };
}

const GreenHandle: React.FC<GreenHandleProps> = ({
    type,
    id,
    position,
    isConnectable,
    hidden,
    style
}) => {
    return (
        <Handle
            type={type}
            position={position}
            id={id}
            isConnectable={isConnectable ? true : false}
            style={{
                position: "absolute",
                width: 5,
                height: 5,
                background: `var(--color-secondary)`,
                borderRadius: "50%",
                border: `0.5px solid var(--color-background)`,
                cursor: "crosshair",
                opacity: hidden ? 0 : 1,
                pointerEvents: hidden ? "none" : "auto",
                transition: "opacity 120ms ease",
                ...style
            }}
        />
    )
}

export { GreenHandle, sideToPosition, sideToStyle }
