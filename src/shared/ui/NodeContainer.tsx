export const NodeContainer: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
    <div style={{
        minWidth:"5rem",
        maxWidth:"10rem",
        paddingLeft:"0.5rem",
        paddingRight:"0.5rem",
        paddingBottom:"1rem",
        border: `2px solid var(--color-secondary)`,
        borderRadius: "10px",
        background: `transparent`,
        textAlign: "center",
        position: "relative",
        overflow: "visible",
        ...style
    }}>
        {children}
    </div>
);
