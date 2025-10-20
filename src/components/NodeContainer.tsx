export const NodeContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{
        minWidth:"5rem",
        maxWidth:"15rem",
        paddingLeft:"0.5rem",
        paddingRight:"0.5rem",
        paddingBottom:"1rem",
        border: `2px solid var(--color-secondary)`,
        borderRadius: "10px",
        background: `transparent`,
        textAlign: "center"
    }}>
        {children}
    </div>
);