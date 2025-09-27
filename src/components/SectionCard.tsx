import { useState } from "react";
import { colors } from "../styles/colors"

type SectionContent = {
    title: string,
    url: string,
    icon: string,
}

interface SectionCardProps {
    sectionContent: SectionContent,
    onClick: ()=>void,
}

const SectionCard: React.FC<SectionCardProps> = ({
    sectionContent,
    onClick
}) => {
    const [focused, setFocused] = useState<boolean>(false);

    return (
        <div style={{
            margin: "1em 1em",
            color: colors.text,
            borderRadius: "5%",
            height: `10px`,
            textShadow: `1px 1px 1px ${colors.secondary}`,
            cursor: "pointer",
            userSelect: "none"
        }}
            className="sectionCard"
            onClick={onClick}
            onMouseOver={() => {
                setFocused(true);
            }}
            onMouseLeave={() => {
                setFocused(false);
            }}
        >
            <img style={{
                width: "1em",
                filter: `drop-shadow(1px 1px 1px ${colors.secondary}`,
            }} src={sectionContent.icon}></img>
            <div>{sectionContent.title}</div>
            {focused && <span>⬆</span>}
        </div >
    )
}


export { SectionCard };
export type { SectionContent }