import React, { useLayoutEffect } from "react";
import { useUpdateNodeInternals } from "@xyflow/react";
import { GreenHandle, sideToPosition, sideToStyle, type DynamicHandle } from "./Handles";
import { type Theme } from "../content/BioTheme";
import ThemePicker from "../ThemePicker";
import { LANGUAGE_OPTIONS } from "../../../i18n";
import { useAppLanguage } from '../../../i18n/useAppLanguage';

interface BioThemeData {
    theme: Theme
    setTheme: (theme: Theme) => void
    handles?: DynamicHandle[]
}

interface BioToggleNodeProps {
    id: string
    data: BioThemeData
}

const BioToggleNode: React.FC<BioToggleNodeProps> = ({
    id,
    data
}) => {
    const { language, setLanguage, messages } = useAppLanguage();
    const updateNodeInternals = useUpdateNodeInternals();

    useLayoutEffect(() => {
        updateNodeInternals(id);
    }, [data.handles, id, language, updateNodeInternals]);

    return (
        <div
            style={{
                position: 'relative',
                display: 'inline-block',
            }}
        >
            <ThemePicker theme={data.theme} setTheme={data.setTheme}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '0.28rem',
                    }}
                    aria-label={messages.appShell.languageLabel}
                >
                    {LANGUAGE_OPTIONS.map((option) => {
                        const selected = option.id === language;
                        const label = messages.appShell.languageOptions[option.id];

                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={(event) => {
                                    setLanguage(option.id);
                                    event.currentTarget.blur();
                                }}
                                aria-pressed={selected}
                                aria-label={messages.appShell.languageMenuLabel(label)}
                                title={label}
                                style={{
                                    padding: '0.08rem 0.18rem',
                                    border: 'none',
                                    background: 'transparent',
                                    color: selected ? 'var(--color-text)' : 'color-mix(in srgb, var(--color-text) 56%, transparent)',
                                    fontSize: '0.62rem',
                                    fontWeight: selected ? 700 : 500,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    lineHeight: 1.1,
                                    outline: 'none',
                                    boxShadow: 'none',
                                    appearance: 'none',
                                    WebkitAppearance: 'none',
                                }}
                            >
                                {option.shortLabel}
                            </button>
                        );
                    })}
                </div>
            </ThemePicker>
            {(data.handles ?? []).map((handle) => (
                <GreenHandle
                    key={handle.id}
                    id={handle.id}
                    type={handle.type}
                    position={sideToPosition(handle.side)}
                    hidden={handle.hidden}
                    style={sideToStyle(handle.side, handle.offset)}
                />
            ))}
        </div>
    )
}

export default React.memo(BioToggleNode);
