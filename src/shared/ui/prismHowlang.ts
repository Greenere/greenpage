import Prism from 'prismjs'

Prism.languages.howlang = {
  comment: {
    pattern: /#.*/,
    greedy: true,
  },
  string: [
    {
      pattern: /"(?:\\[ntr"'\\]|[^"\\\r\n])*"/,
      greedy: true,
      inside: {
        punctuation: /^"|"$/,
        escape: /\\[ntr"'\\]/,
      },
    },
    {
      pattern: /'(?:\\[ntr"'\\]|[^'\\\r\n])*'/,
      greedy: true,
      inside: {
        punctuation: /^'|'$/,
        escape: /\\[ntr"'\\]/,
      },
    },
  ],
  keyword: /\b(?:var|how|where|as|break|continue|catch|and|or|not)\b/,
  boolean: /\b(?:true|false|none)\b/,
  number: /\b\d+(?:\.\d+)?\b/,
  function: /\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/,
  'class-name': /\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\[)/,
  operator: /!!|::|\+=|-=|\*=|\/=|%=|==|!=|<=|>=|&&|\|\||[+\-*/%=<>:@^.]/,
  punctuation: /[()[\]{},]/,
}

Prism.languages.how = Prism.languages.howlang
