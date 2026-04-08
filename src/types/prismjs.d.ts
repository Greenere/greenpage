declare module 'prismjs' {
  type Grammar = Record<string, unknown>

  type PrismApi = {
    languages: Record<string, Grammar | undefined>
    highlight: (text: string, grammar: Grammar, language: string) => string
  }

  const Prism: PrismApi
  export default Prism
}

declare module 'prismjs/components/*'
