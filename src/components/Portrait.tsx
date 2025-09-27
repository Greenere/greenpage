import { useState } from "react"

type PortraitContent = {
    imgSrc: string,
    url: string
}

interface PortraitProps {
    portrait: PortraitContent,
    highContent?: string
}

export const Portrait: React.FC<PortraitProps> = ({
    portrait,
    highContent
}) => {
    const [focused, setFocused] = useState<boolean>(false);

    return (
        <a
            href={portrait.url}
            target="_blank"
            onMouseOver={() => {
                setFocused(true);
            }}
            onMouseLeave={() => {
                setFocused(false);
            }}
        >
            <img src={portrait.imgSrc} style={{
                width: `${highContent? 100:200}px`,
                borderRadius: "50%",
                filter: `drop-shadow(2px 2px ${focused ? 10 : 5}px rgba(0, 0, 0, 0.5))`,
                transition: "width 2000ms ease, filter 200ms ease",
                willChange: "width, filter",
            }} />
        </a>
    )
}

export type { PortraitContent }