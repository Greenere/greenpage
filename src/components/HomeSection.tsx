import { SectionCard, type SectionContent } from "./SectionCard"

interface HomeSectionProps {
    sections: SectionContent[]
}

const HomeSection: React.FC<HomeSectionProps> = ({
    sections
}) => {
    return (
        <div className="card">
            {sections && sections.map((section, idx) => {
                return (
                    <SectionCard key={idx} sectionContent={section} />
                )
            })
            }
        </div>
    )
}

export { HomeSection }