import { SectionCard, type SectionContent } from "./SectionCard"

interface HomeSectionProps {
    sections: SectionContent[],
    selectContent: (content: string) => void,
}

const HomeSection: React.FC<HomeSectionProps> = ({
    sections,
    selectContent
}) => {
    return (
        <div className="card">
            {
                sections && sections.map((section, idx) => {
                    return (
                        <SectionCard
                            key={idx}
                            sectionContent={section}
                            onClick={() => {
                                selectContent(section.title)
                                window.open(section.url, "_blank");
                            }}
                        />
                    )
                })
            }
        </div>
    )
}

export { HomeSection }