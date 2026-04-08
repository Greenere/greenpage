import { useMemo, type CSSProperties } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-yaml'
import './prismHowlang'

import './CodeBlock.css'

const LANGUAGE_ALIASES: Record<string, string> = {
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  how: 'howlang',
  howlang: 'howlang',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  py: 'python',
}

function normalizeLanguage(language?: string) {
  if (!language) return null

  const normalized = language.trim().toLowerCase()
  if (!normalized) return null

  return LANGUAGE_ALIASES[normalized] ?? normalized
}

type CodeBlockProps = {
  code: string
  language?: string
  maxWidth?: CSSProperties['maxWidth']
  margin?: CSSProperties['margin']
  padding?: CSSProperties['padding']
  borderRadius?: CSSProperties['borderRadius']
  fontSize?: CSSProperties['fontSize']
  lineHeight?: CSSProperties['lineHeight']
  showLanguageLabel?: boolean
}

export default function CodeBlock({
  code,
  language,
  maxWidth,
  margin = '0 0 1.2rem',
  padding = '0.95rem 1rem',
  borderRadius = '16px',
  fontSize = '0.82rem',
  lineHeight = 1.65,
  showLanguageLabel = true,
}: CodeBlockProps) {
  const normalizedLanguage = normalizeLanguage(language)
  const grammar = normalizedLanguage ? Prism.languages[normalizedLanguage] : undefined

  const highlightedCode = useMemo(() => {
    if (!normalizedLanguage || !grammar) {
      return null
    }

    return Prism.highlight(code, grammar, normalizedLanguage)
  }, [code, grammar, normalizedLanguage])

  return (
    <figure
      style={{
        maxWidth,
        margin,
      }}
    >
      {showLanguageLabel && language && (
        <div
          style={{
            display: 'block',
            marginBottom: '0.4rem',
            textTransform: 'uppercase',
            letterSpacing: '0.11em',
            fontSize: '0.64rem',
            opacity: 0.68,
          }}
        >
          {language}
        </div>
      )}
      <pre
        className="greenpage-code-block"
        style={{
          margin: 0,
          padding,
          borderRadius,
          fontSize,
          lineHeight,
        }}
      >
        {highlightedCode ? (
          <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </figure>
  )
}
