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
          <p className="mb-3 last:mb-0" {...props} />
        ),
        strong: ({ node, ...props }) => (
          <strong className="font-bold" {...props} />
        ),
        em: ({ node, ...props }) => (
          <em className="italic" {...props} />
        ),
        h1: ({ node, ...props }) => (
          <h1 className="text-xl font-bold mb-3 mt-3" {...props} />
        ),
        h2: ({ node, ...props }) => (
          <h2 className="text-lg font-bold mb-2 mt-3" {...props} />
        ),
        h3: ({ node, ...props }) => (
          <h3 className="text-base font-bold mb-2 mt-2" {...props} />
        ),
        ul: ({ node, ...props }) => (
          <ul className="list-disc list-inside mb-3 space-y-1" {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol className="list-decimal list-inside mb-3 space-y-1" {...props} />
        ),
        li: ({ node, ...props }) => (
          <li className="ml-2" {...props} />
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
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

MarkdownMessage.displayName = 'MarkdownMessage';
