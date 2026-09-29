export function normalizeMarkdown(text: string) {
  return text
    .replace(/\\(?=\*)/g, "")
    .replace(/[＊∗✱﹡]/g, "*")
}

export function splitMarkdownBold(text: string): Array<{ bold: boolean; value: string }> {
  const source = normalizeMarkdown(text)
  const parts: Array<{ bold: boolean; value: string }> = []
  const pattern = /\*\*([\s\S]+?)\*\*/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > last) {
      parts.push({ bold: false, value: source.slice(last, match.index) })
    }
    parts.push({ bold: true, value: match[1] })
    last = match.index + match[0].length
  }

  const rest = source.slice(last).replace(/\*\*/g, "")
  if (rest) {
    parts.push({ bold: false, value: rest })
  }
  return parts
}
