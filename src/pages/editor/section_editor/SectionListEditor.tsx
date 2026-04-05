import { type NodeArticleSection } from '../../graph/content/Nodes';
import InlineSectionCard from './InlineSectionCard';

type SectionListEditorProps = {
  sections: NodeArticleSection[];
  editingSectionIndex: number | null;
  onStartEditing: (sectionIndex: number) => void;
  onStopEditing: (sectionIndex: number) => void;
  onChangeSection: (sectionIndex: number, nextSection: NodeArticleSection) => void;
  onDeleteSection: (sectionIndex: number, section: NodeArticleSection) => void;
  onAddSectionAfter: (sectionIndex: number) => void;
};

export default function SectionListEditor({
  sections,
  editingSectionIndex,
  onStartEditing,
  onStopEditing,
  onChangeSection,
  onDeleteSection,
  onAddSectionAfter,
}: SectionListEditorProps) {
  return (
    <>
      {sections.map((section, sectionIndex) => (
        <InlineSectionCard
          key={section.id ?? `section-${sectionIndex}`}
          section={section}
          sectionIndex={sectionIndex}
          isEditing={editingSectionIndex === sectionIndex}
          onStartEditing={() => onStartEditing(sectionIndex)}
          onStopEditing={() => onStopEditing(sectionIndex)}
          onChange={(nextSection) => onChangeSection(sectionIndex, nextSection)}
          onDelete={() => onDeleteSection(sectionIndex, section)}
          onAddAfter={() => onAddSectionAfter(sectionIndex)}
        />
      ))}
    </>
  );
}
