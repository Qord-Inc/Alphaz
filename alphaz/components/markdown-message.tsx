'use client';

import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownMessageProps {
  content: string;
}

export const MarkdownMessage = memo(({ content }: MarkdownMessageProps) => {
  return (
    <ReactMarkdown
      components={{
        p: ({ node, ...props }) => (
          <p className="mb-2.5 last:mb-0 leading-relaxed text-[15px] text-foreground" {...props} />
        ),
        strong: ({ node, ...props }) => (
          <strong className="font-semibold text-foreground" {...props} />
        ),
        em: ({ node, ...props }) => (
          <em className="italic text-foreground/90" {...props} />
        ),
        h1: ({ node, ...props }) => (
          <h1 className="text-lg font-bold mb-3 mt-0 text-foreground" {...props} />
        ),
        h2: ({ node, ...props }) => (
          <h2 className="text-base font-bold mb-3 mt-0 text-foreground" {...props} />
        ),
        h3: ({ node, ...props }) => (
          <h3 className="text-sm font-semibold mb-2 mt-2 text-foreground" {...props} />
        ),
        ul: ({ node, ...props }) => (
          <ul className="list-disc ml-4 mb-3 space-y-1.5 text-sm" {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol className="list-decimal ml-4 mb-3 space-y-1.5 text-sm" {...props} />
        ),
        li: ({ node, ...props }) => (
          <li className="text-foreground/90 leading-relaxed pl-1" {...props} />
        ),
        code: ({ node, className, ...props }) => {
          const isInline = !className?.includes('language-');
          return isInline ? (
            <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm font-mono" {...props} />
          ) : (
            <code className="block bg-gray-200 dark:bg-gray-700 p-3 rounded mb-3 overflow-x-auto font-mono text-sm" {...props} />
          );
        },
        pre: ({ node, ...props }) => (
          <pre className="bg-gray-200 dark:bg-gray-700 p-3 rounded mb-3 overflow-x-auto" {...props} />
        ),
        blockquote: ({ node, ...props }) => (
          <blockquote className="border-l-4 border-gray-400 pl-4 italic my-3" {...props} />
        ),
        a: ({ node, ...props }) => (
          <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
        ),
        hr: ({ node, ...props }) => (
          <hr className="my-4 border-t border-border/50" {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

MarkdownMessage.displayName = 'MarkdownMessage';
