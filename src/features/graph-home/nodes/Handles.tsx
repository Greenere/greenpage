import { Handle, Position } from "@xyflow/react"

interface GreenHandleProps {
    type: 'source' | 'target'
    id: string
    position: Position
    style?: Record<string, unknown>
    isConnectable?: boolean
}

const GreenHandle: React.FC<GreenHandleProps> = ({
    type,
    id,
    position,
    isConnectable,
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
                ...style
            }}
        />
    )
}

export { GreenHandle }