import { UI_COPY } from '../../../configs/ui/uiCopy';
import { DETAIL_SECTION_WIDTH } from '../articlePreviewShared';
import { type NodeArticleSection } from '../../graph/content/Nodes';
import InlineSectionCard from './InlineSectionCard';

type SectionListEditorProps = {
  sections: NodeArticleSection[];
  editingSectionIndex: number | null;
  onStartEditing: (sectionIndex: number) => void;
  onStopEditing: (sectionIndex: number) => void;
  onChangeSection: (sectionIndex: number, nextSection: NodeArticleSection) => void;
  onDeleteSection: (sectionIndex: number, section: NodeArticleSection) => void;
  onAddSection: () => void;
};

export default function SectionListEditor({
  sections,
  editingSectionIndex,
  onStartEditing,
  onStopEditing,
  onChangeSection,
  onDeleteSection,
  onAddSection,
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
        />
      ))}

      <div
        style={{
          maxWidth: DETAIL_SECTION_WIDTH,
          marginInline: 'auto',
          display: 'flex',
          justifyContent: 'center',
          paddingTop: '0.5rem',
          paddingBottom: '2rem',
        }}
      >
        <button
          type="button"
          onClick={onAddSection}
          style={{
            padding: '0.38rem 1rem',
            borderRadius: '999px',
            border: '1px solid color-mix(in srgb, var(--color-secondary) 30%, transparent)',
            background: 'transparent',
            color: 'var(--color-text)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontFamily: 'inherit',
            opacity: 0.7,
          }}
          title={UI_COPY.nodeEditor.sectionEditor.addSectionTitle}
        >
          {UI_COPY.nodeEditor.sectionEditor.addSection}
        </button>
      </div>
    </>
  );
}
