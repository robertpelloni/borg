'use client';

import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PlanContent } from './plan-content';

interface ActivityContentProps {
  content: string;
  metadata?: Record<string, any>;
}

const formatContent = (content: string, metadata?: Record<string, any>): React.ReactNode => {
  const trimmedContent = content.trim();

  // 1. Handle Placeholders
  if (trimmedContent === '[userMessaged]' || trimmedContent === '[agentMessaged]') {
      // Try to recover content from metadata if available
      const realContent = metadata?.original_content || metadata?.message || metadata?.text;
      if (realContent && typeof realContent === 'string') {
           // If we found real content, recursively format it
           return formatContent(realContent, undefined);
      }

      if (trimmedContent === '[userMessaged]') return <span className="text-white/50 italic">Message sent</span>;
      if (trimmedContent === '[agentMessaged]') return <span className="text-white/50 italic">Agent working...</span>;
  }

  // 2. Try JSON Parsing
  if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmedContent);

        // Handle Empty JSON
        if (typeof parsed === 'object' && parsed !== null) {
           if (Array.isArray(parsed) && parsed.length === 0) return null;
           if (!Array.isArray(parsed) && Object.keys(parsed).length === 0) return null;
        }

        // Handle Plan Content
        if (Array.isArray(parsed) || (parsed.steps && Array.isArray(parsed.steps))) {
          return <PlanContent content={parsed} />;
        }

        // Handle Wrapped Messages (e.g. { "message": "..." } or { "content": "..." })
        if (!Array.isArray(parsed) && typeof parsed === 'object') {
           const possibleContent = parsed.message || parsed.content || parsed.text || parsed.response || parsed.msg || parsed.output || parsed.result || parsed.userMessage;
           if (possibleContent && typeof possibleContent === 'string') {
               // Recursively format the extracted content
               return formatContent(possibleContent, metadata);
           }
        }

        return <pre className="text-[11px] overflow-x-auto font-mono bg-muted/50 p-2 rounded whitespace-pre-wrap break-words">{JSON.stringify(parsed, null, 2)}</pre>;
      } catch {
        // Fall through to markdown
      }
  }

  // 3. Render as Markdown
  return (
      <div className="prose prose-sm dark:prose-invert max-w-none break-words whitespace-pre-wrap prose-p:text-xs prose-p:leading-relaxed prose-p:break-words prose-headings:text-xs prose-headings:font-semibold prose-headings:mb-1 prose-headings:mt-2 prose-ul:text-xs prose-ol:text-xs prose-li:text-xs prose-li:my-0.5 prose-code:text-[11px] prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:break-all prose-pre:text-[11px] prose-pre:bg-muted prose-pre:p-2 prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-pre:break-all prose-blockquote:text-xs prose-blockquote:border-l-primary prose-strong:font-semibold overflow-hidden">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
  );
};

export const ActivityContent = memo(function ActivityContent({ content, metadata }: ActivityContentProps) {
  const formatted = useMemo(() => formatContent(content, metadata), [content, metadata]);
  return <>{formatted}</>;
});
