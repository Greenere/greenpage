import { useEffect, useMemo, useState } from 'react';
import { UI_COPY } from '../../../configs/ui/uiCopy';
import { useAppLanguage } from '../../../i18n/useAppLanguage';
import type { DomainId } from '../../../configs/content/domains';
import type { EditorNodeOption } from '../editorApi';
import { formatEditorNodeOptionLabel, getEditorNodeSearchText, getEditorNodeTitle, sortNodeRefs } from '../editorNodeUtils';
import { inputStyle, btnDisabled } from './editorStyles';

export function SearchableNodePicker({
  options,
  value,
  currentDomain,
  onSelect,
  placeholder = UI_COPY.nodeEditor.contentTab.otherNodePlaceholder,
  disabled = false,
  maxResults = 8,
  menuMaxHeight = '16rem',
}: {
  options: EditorNodeOption[];
  value: string;
  currentDomain?: DomainId;
  onSelect: (nodeId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxResults?: number;
  menuMaxHeight?: string;
}) {
  const { language } = useAppLanguage();
  const selectedOption = options.find((node) => node.id === value);
  const [query, setQuery] = useState(() => (selectedOption ? formatEditorNodeOptionLabel(selectedOption) : ''));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedOption ? formatEditorNodeOptionLabel(selectedOption) : '');
  }, [selectedOption]);

  const filteredOptions = useMemo(() => {
    void language;
    const normalizedQuery = query.trim().toLowerCase();

    return options
      .filter((node) => !normalizedQuery || getEditorNodeSearchText(node).includes(normalizedQuery))
      .sort((left, right) => {
        const leftQueryText = getEditorNodeSearchText(left);
        const rightQueryText = getEditorNodeSearchText(right);
        const leftStartsWith = normalizedQuery
          ? left.id.toLowerCase().startsWith(normalizedQuery) || (left.title?.toLowerCase().startsWith(normalizedQuery) ?? false)
          : false;
        const rightStartsWith = normalizedQuery
          ? right.id.toLowerCase().startsWith(normalizedQuery) || (right.title?.toLowerCase().startsWith(normalizedQuery) ?? false)
          : false;

        if (leftStartsWith !== rightStartsWith) return leftStartsWith ? -1 : 1;

        const leftInCurrentDomain = currentDomain ? left.domain === currentDomain : false;
        const rightInCurrentDomain = currentDomain ? right.domain === currentDomain : false;
        if (leftInCurrentDomain !== rightInCurrentDomain) return leftInCurrentDomain ? -1 : 1;

        if (leftQueryText !== rightQueryText && normalizedQuery) {
          const leftTitleMatch = leftQueryText.indexOf(normalizedQuery);
          const rightTitleMatch = rightQueryText.indexOf(normalizedQuery);
          if (leftTitleMatch !== rightTitleMatch) return leftTitleMatch - rightTitleMatch;
        }

        return sortNodeRefs(left, right);
      })
      .slice(0, maxResults);
  }, [currentDomain, language, maxResults, options, query]);

  const resetQuery = () => {
    setQuery(selectedOption ? formatEditorNodeOptionLabel(selectedOption) : '');
  };

  const handleSelect = (nodeId: string) => {
    onSelect(nodeId);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        disabled={disabled}
        value={query}
        onChange={(event) => {
          if (disabled) return;
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => { if (disabled) return; setOpen(true); }}
        onBlur={() => {
          window.setTimeout(() => { setOpen(false); resetQuery(); }, 0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && filteredOptions.length > 0) {
            event.preventDefault();
            handleSelect(filteredOptions[0].id);
          }
          if (event.key === 'Escape') { setOpen(false); resetQuery(); }
        }}
        placeholder={placeholder}
        style={disabled ? { ...inputStyle(), ...btnDisabled } : inputStyle()}
      />
      {open && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.35rem)',
            left: 0,
            right: 0,
            zIndex: 5,
            padding: '0.35rem',
            borderRadius: '12px',
            border: '1px solid color-mix(in srgb, var(--color-secondary) 30%, transparent)',
            background: 'color-mix(in srgb, var(--color-background) 96%, white 4%)',
            boxShadow: '0 18px 40px rgba(0, 0, 0, 0.08)',
            display: 'grid',
            gap: '0.2rem',
            maxHeight: menuMaxHeight,
            overflowY: 'auto',
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((node) => (
              <button
                key={node.id}
                type="button"
                onMouseDown={(event) => { event.preventDefault(); handleSelect(node.id); }}
                style={{
                  padding: '0.55rem 0.6rem',
                  borderRadius: '9px',
                  border: 'none',
                  background: value === node.id ? 'color-mix(in srgb, var(--color-background) 84%, white 16%)' : 'transparent',
                  color: 'var(--color-text)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: '0.84rem', fontWeight: 600, lineHeight: 1.35 }}>
                  {getEditorNodeTitle(node, node.id)}
                </div>
                <div style={{ marginTop: '0.18rem', fontSize: '0.72rem', opacity: 0.72, lineHeight: 1.45 }}>
                  {node.domain} / {node.id}
                  {node.subtitle ? ` · ${node.subtitle}` : ''}
                </div>
              </button>
            ))
          ) : (
            <div style={{ padding: '0.55rem 0.6rem', fontSize: '0.76rem', opacity: 0.68, lineHeight: 1.45 }}>
              No matching nodes.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
