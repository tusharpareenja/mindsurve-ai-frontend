"use client"

import { Fragment, type ReactNode } from "react"
import { normalizeMarkdown, splitMarkdownBold } from "./assistantMarkdown"

export function renderInlineMarkdown(text: string): ReactNode[] {
  return splitMarkdownBold(text).map((part, key) =>
    part.bold ? (
      <span key={key} className="font-bold text-gray-950" style={{ fontWeight: 700 }}>
        {part.value}
      </span>
    ) : (
      <Fragment key={key}>{part.value}</Fragment>
    )
  )
}

function isNumbered(line: string) {
  return /^\d{1,2}\.\s+\S/.test(line)
}

function isBullet(line: string) {
  return /^[-*]\s+\S/.test(line) && !/^\*\*/.test(line)
}

function stripMarker(line: string) {
  return line.replace(/^(\d{1,2}\.|[-*])\s+/, "")
}

export function AssistantMarkdownText({ text }: { text: string }) {
  const source = normalizeMarkdown((text || "").replace(/\r\n/g, "\n")).trim()
  if (!source) return null

  const blocks: ReactNode[] = []
  const lines = source.split("\n")
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    if (isNumbered(line) || isBullet(line)) {
      const numbered = isNumbered(line)
      const items: string[] = []
      while (index < lines.length && (numbered ? isNumbered(lines[index]) : isBullet(lines[index]))) {
        items.push(stripMarker(lines[index]))
        index += 1
      }
      const ListTag = numbered ? "ol" : "ul"
      blocks.push(
        <ListTag
          key={`list-${blocks.length}`}
          className={
            numbered
              ? "my-2 list-decimal space-y-1.5 pl-5 marker:font-semibold"
              : "my-2 list-disc space-y-1.5 pl-5"
          }
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="leading-relaxed">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ListTag>
      )
      continue
    }

    const paragraph: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isNumbered(lines[index]) &&
      !isBullet(lines[index])
    ) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-relaxed">
        {renderInlineMarkdown(paragraph.join(" "))}
      </p>
    )
  }

  return <div className="space-y-2 break-words text-sm text-gray-900">{blocks}</div>
}
