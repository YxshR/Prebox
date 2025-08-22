import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { cn } from '@/lib/utils';

interface SyntaxHighlighterProps {
  children: string;
  language?: string;
  className?: string;
  showLineNumbers?: boolean;
}

const CustomSyntaxHighlighter: React.FC<SyntaxHighlighterProps> = ({
  children,
  language = 'javascript',
  className,
  showLineNumbers = false
}) => {
  return (
    <div className={cn('rounded-md overflow-hidden', className)}>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers={showLineNumbers}
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.875rem',
          lineHeight: '1.5'
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
};

export default CustomSyntaxHighlighter;