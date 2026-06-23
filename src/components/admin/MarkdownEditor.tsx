import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BlogContentRenderer } from '@/components/BlogContentRenderer';
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Redo, Undo } from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Markdown editor with a formatting toolbar and a live Write/Preview split.
 * The preview uses the site's real BlogContentRenderer, so what the operator
 * sees here is exactly how the post renders on the public blog.
 */
export const MarkdownEditor = ({ value, onChange }: MarkdownEditorProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);

  // Record history then push the new value to the parent.
  const commit = (next: string) => {
    past.current.push(value);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    onChange(next);
  };

  const undo = () => {
    if (!past.current.length) return;
    future.current.push(value);
    onChange(past.current.pop()!);
  };

  const redo = () => {
    if (!future.current.length) return;
    past.current.push(value);
    onChange(future.current.pop()!);
  };

  const restoreSelection = (start: number, end: number) => {
    requestAnimationFrame(() => {
      const ta = ref.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(start, end);
    });
  };

  // Wrap the current selection (or a placeholder) with markers, e.g. **bold**.
  const surround = (marker: string, placeholder: string) => {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const selected = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + marker + selected + marker + value.slice(e);
    commit(next);
    restoreSelection(s + marker.length, s + marker.length + selected.length);
  };

  // Prefix each line in the selection (bullets / numbered lists).
  const prefixLines = (kind: 'bullet' | 'number') => {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const block = value.slice(lineStart, e) || 'List item';
    const replaced = block
      .split('\n')
      .map((line, i) => (kind === 'number' ? `${i + 1}. ${line}` : `- ${line}`))
      .join('\n');
    const next = value.slice(0, lineStart) + replaced + value.slice(e);
    commit(next);
  };

  // Set the heading level of the current line (## / ### / none).
  const setHeading = (level: string) => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = value.indexOf('\n', s);
    if (lineEnd === -1) lineEnd = value.length;
    const line = value.slice(lineStart, lineEnd).replace(/^#{1,6}\s+/, '');
    const prefix = level === 'h2' ? '## ' : level === 'h3' ? '### ' : '';
    const next = value.slice(0, lineStart) + prefix + line + value.slice(lineEnd);
    commit(next);
  };

  const insertLink = () => {
    const ta = ref.current;
    if (!ta) return;
    const url = window.prompt('Link URL', 'https://');
    if (!url) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const text = value.slice(s, e) || 'link text';
    const next = value.slice(0, s) + `[${text}](${url})` + value.slice(e);
    commit(next);
  };

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/40 p-1">
        <Select onValueChange={setHeading}>
          <SelectTrigger className="h-8 w-[130px] border-0 bg-transparent">
            <SelectValue placeholder="Heading" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Normal text</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
          </SelectContent>
        </Select>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => surround('**', 'bold text')}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => surround('*', 'italic text')}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={insertLink}>
          <LinkIcon className="h-4 w-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => prefixLines('bullet')}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => prefixLines('number')}>
          <ListOrdered className="h-4 w-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={undo}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={redo}>
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* Write / Preview split */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Write</p>
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => commit(e.target.value)}
            rows={16}
            placeholder="Write your blog post content here."
            className="w-full rounded-md border border-input bg-background p-3 font-mono text-sm leading-relaxed ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Preview</p>
          <div className="min-h-[16rem] overflow-y-auto rounded-md border border-border bg-muted/20 p-3">
            {value.trim() ? (
              <BlogContentRenderer
                content={value}
                className="prose prose-sm max-w-none font-playfair text-foreground"
              />
            ) : (
              <p className="italic text-muted-foreground">Start writing to see live preview…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
