import { useRef, type PropsWithChildren } from "react";

interface ContentPanelProps extends PropsWithChildren {
    open: boolean
}

const ContentPanel: React.FC<ContentPanelProps> = ({ open, children }) => {
    const ref = useRef<HTMLDivElement>(null);
    return (
        <div
            ref={ref}
            style={{
                height: open ? "10em" : "0",
                overflow: "hidden",
                opacity: open ? 1 : 0,
                transition: "height 2000ms ease, opacity 200ms ease",
                willChange: "height, opacity"
            }}
        >
            <div style={{ padding: "0.5rem 0" }}>
                <div style={{ height: "10em" }}>{children}</div>
            </div>
        </div>
    );
}

export { ContentPanel }

