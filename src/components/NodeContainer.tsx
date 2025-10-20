export const NodeContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{
        minWidth:"5rem",
        maxWidth:"12rem",
        paddingLeft:"0.5rem",
        paddingRight:"0.5rem",
        paddingBottom:"1rem",
        border: `2px solid var(--color-secondary)`,
        borderRadius: "16px",
        background: `var(--color-background)`
    }}>
        {children}
    </div>
);