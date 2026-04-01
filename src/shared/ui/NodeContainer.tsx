export const NodeContainer: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
    const {
        boxShadow,
        transition,
        ...restStyle
    } = style ?? {};

    return (
        <div style={{
            minWidth:"5rem",
            maxWidth:"10rem",
            paddingLeft:"0.5rem",
            paddingRight:"0.5rem",
            paddingBottom:"1rem",
            border: `1px solid transparent`,
            borderRadius: "10px",
            background: `transparent`,
            textAlign: "center",
            position: "relative",
            overflow: "visible",
            boxShadow: [
                `var(--greenpage-node-ring-shadow-prefix, inset 0 0 0) var(--greenpage-node-ring-width, 1.5px) var(--greenpage-node-ring-color, color-mix(in srgb, var(--color-secondary) 38%, transparent))`,
                boxShadow,
            ].filter(Boolean).join(', '),
            transition: [
                'box-shadow 170ms ease',
                'background-color 170ms ease',
                transition,
            ].filter(Boolean).join(', '),
            ...restStyle
        }}>
            {children}
        </div>
    );
};
