/**
 * Browser renderer for the markdown AST (ADR-0030 §4.2).
 *
 * Headings, tables, lists, fences, and quotes are blocks; inline markup is
 * applied inside them. Parse/render failures fall back to preformatted text
 * so a single reply cannot blank the harness.
 */

import {
  normalizeAssistantMarkdown,
  parseMarkdown,
  type InlineNode,
  type ListItem,
  type MarkdownBlock,
} from "./markdownAst";
import { highlightLine, resolveLanguage, type TokenKind } from "./syntaxHighlight";
import { memo, type ReactNode } from "react";
import styles from "./MarkdownView.module.css";

interface MarkdownViewProps {
  readonly source: string | undefined;
}

export const MarkdownView = memo(function MarkdownView({ source }: MarkdownViewProps): JSX.Element {
  if (source === undefined || source.length === 0) return <></>;
  try {
    const blocks = parseMarkdown(normalizeAssistantMarkdown(source));
    if (blocks.length === 0) return <></>;
    return (
      <div className={styles.root}>{blocks.map((block, index) => renderBlock(block, index))}</div>
    );
  } catch {
    return <pre className={styles.fallback}>{source}</pre>;
  }
});

function renderBlock(block: MarkdownBlock, key: number): ReactNode {
  switch (block.kind) {
    case "heading": {
      const Tag = headingTag(block.level);
      return (
        <Tag key={key} className={styles.heading} data-level={block.level}>
          <Inline spans={block.spans} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className={styles.paragraph}>
          <Inline spans={block.spans} />
        </p>
      );
    case "code":
      return <CodeBlock key={key} language={block.language} lines={block.lines} />;
    case "list":
      return <ListBlock key={key} items={block.items} />;
    case "quote":
      return (
        <blockquote key={key} className={styles.quote}>
          {block.blocks.map((inner, index) => renderBlock(inner, index))}
        </blockquote>
      );
    case "rule":
      return <hr key={key} className={styles.rule} />;
    case "table":
      return (
        <div key={key} className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {block.header.map((cell, index) => (
                  <th key={index} style={{ textAlign: block.alignments[index] ?? "left" }}>
                    <Inline spans={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => (
                    <td key={index} style={{ textAlign: block.alignments[index] ?? "left" }}>
                      <Inline spans={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function headingTag(level: number): "h1" | "h2" | "h3" | "h4" | "h5" | "h6" {
  if (level <= 1) return "h1";
  if (level === 2) return "h2";
  if (level === 3) return "h3";
  if (level === 4) return "h4";
  if (level === 5) return "h5";
  return "h6";
}

function Inline({ spans }: { readonly spans: readonly InlineNode[] }): JSX.Element {
  return (
    <>
      {spans.map((span, index) => (
        <InlineSpan key={index} span={span} />
      ))}
    </>
  );
}

function InlineSpan({ span }: { readonly span: InlineNode }): JSX.Element {
  switch (span.kind) {
    case "text":
      return <>{span.value}</>;
    case "strong":
      return <strong>{span.value}</strong>;
    case "emphasis":
      return <em>{span.value}</em>;
    case "strike":
      return <del>{span.value}</del>;
    case "code":
      return <code className={styles.inlineCode}>{span.value}</code>;
    case "link": {
      const href = sanitizeHref(span.href);
      if (href === undefined) return <span>{span.value}</span>;
      return (
        <a className={styles.link} href={href} target="_blank" rel="noreferrer noopener">
          {span.value}
        </a>
      );
    }
  }
}

function sanitizeHref(href: string): string | undefined {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|#|\/)/i.test(trimmed)) return trimmed;
  return undefined;
}

function ListBlock({ items }: { readonly items: readonly ListItem[] }): JSX.Element {
  return (
    <div className={styles.list}>
      {items.map((item, index) => (
        <div key={index} className={styles.listRow} data-depth={item.depth}>
          <span className={styles.listMarker} aria-hidden="true">
            {listMarker(item)}
          </span>
          <div className={styles.listBody}>
            <Inline spans={item.spans} />
          </div>
        </div>
      ))}
    </div>
  );
}

function listMarker(item: ListItem): string {
  if (item.checked === true) return "☑";
  if (item.checked === false) return "☐";
  if (item.ordinal !== undefined) return `${item.ordinal}.`;
  return "•";
}

function CodeBlock({
  language,
  lines,
}: {
  readonly language: string | undefined;
  readonly lines: readonly string[];
}): JSX.Element {
  const resolved = resolveLanguage(language);
  return (
    <pre
      className={styles.codeBlock}
      {...(language !== undefined ? { "data-language": language } : {})}
    >
      <code>
        {lines.map((line, index) => (
          <span key={index} className={styles.codeLine}>
            {highlightLine(line, resolved).map((token, tokenIndex) => {
              const cls = tokenClass(token.kind);
              return cls === undefined ? (
                <span key={tokenIndex}>{token.value}</span>
              ) : (
                <span key={tokenIndex} className={cls}>
                  {token.value}
                </span>
              );
            })}
            {index < lines.length - 1 ? "\n" : ""}
          </span>
        ))}
      </code>
    </pre>
  );
}

function tokenClass(kind: TokenKind): string | undefined {
  switch (kind) {
    case "comment":
      return styles.tokComment;
    case "string":
      return styles.tokString;
    case "number":
      return styles.tokNumber;
    case "keyword":
      return styles.tokKeyword;
    case "type":
      return styles.tokType;
    case "function":
      return styles.tokFunction;
    case "punctuation":
      return styles.tokPunctuation;
    case "added":
      return styles.tokAdded;
    case "removed":
      return styles.tokRemoved;
    case "meta":
      return styles.tokMeta;
    default:
      return undefined;
  }
}
