import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const notionTheme = EditorView.theme({
  "&": {
    color: "var(--text-primary)",
    backgroundColor: "var(--bg-primary)",
    height: "100%",
    fontSize: "12.5px"
  },
  ".cm-content": {
    caretColor: "var(--text-primary)",
    fontFamily: "Courier, monospace"
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--text-primary)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--bg-hover)" },
  ".cm-panels": { 
    backgroundColor: "var(--bg-secondary)", 
    color: "var(--text-primary)",
    border: "1px solid var(--border-color)",
    borderBottomLeftRadius: "4px",
    borderBottomRightRadius: "4px"
  },
  ".cm-search": {
    padding: "6px 12px",
    display: "flex",
    gap: "6px",
    alignItems: "center"
  },
  ".cm-search label": {
    fontSize: "11px",
    fontWeight: "500",
    color: "var(--text-secondary)"
  },
  ".cm-search button": {
    fontSize: "11px",
    padding: "2px 6px",
    border: "1px solid var(--border-color)",
    borderRadius: "3px",
    cursor: "pointer",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)"
  },
  ".cm-search button:hover": {
    backgroundColor: "var(--bg-hover)"
  },
  ".cm-search input": {
    fontSize: "12px",
    padding: "2px 6px",
    border: "1px solid var(--border-color)",
    borderRadius: "3px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
    outline: "none"
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-secondary)",
    borderRight: "1px solid var(--border-color)",
    userSelect: "none"
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 12px",
    minWidth: "40px"
  },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--text-secondary)"
  }
}, { dark: false });

const notionHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "var(--text-primary)", fontWeight: "bold" },
  { tag: t.propertyName, color: "var(--syntax-key)", fontWeight: "600" }, // JSON keys
  { tag: t.string, color: "var(--syntax-string)" }, // JSON strings
  { tag: t.number, color: "var(--syntax-number)" }, // JSON numbers
  { tag: t.bool, color: "var(--syntax-bool)" }, // JSON booleans
  { tag: t.null, color: "var(--syntax-null)" }, // JSON null values
  { tag: t.separator, color: "var(--text-primary)" },
  { tag: t.bracket, color: "var(--text-primary)" },
  { tag: t.comment, color: "var(--text-secondary)", fontStyle: "italic" }
]);

export const notionThemeExtension = [
  notionTheme,
  syntaxHighlighting(notionHighlightStyle)
];
