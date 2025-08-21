'use client';

import { useEffect, useRef } from 'react';

interface SyntaxHighlighterProps {
  code: string;
  language: string;
  className?: string;
}

export default function SyntaxHighlighter({ code, language, className = '' }: SyntaxHighlighterProps) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && codeRef.current) {
      // Simple syntax highlighting for common languages
      const highlightCode = (code: string, lang: string) => {
        switch (lang.toLowerCase()) {
          case 'javascript':
          case 'js':
            return code
              .replace(/(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await)\b/g, '<span class="text-purple-400">$1</span>')
              .replace(/(true|false|null|undefined)\b/g, '<span class="text-orange-400">$1</span>')
              .replace(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="text-green-400">$1$2$1</span>')
              .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '<span class="text-gray-500">$&</span>')
              .replace(/\b(\d+\.?\d*)\b/g, '<span class="text-blue-400">$1</span>');
          
          case 'python':
            return code
              .replace(/(def|class|import|from|if|elif|else|for|while|try|except|finally|with|as|return|yield|lambda|and|or|not|in|is|True|False|None)\b/g, '<span class="text-purple-400">$1</span>')
              .replace(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="text-green-400">$1$2$1</span>')
              .replace(/#.*$/gm, '<span class="text-gray-500">$&</span>')
              .replace(/\b(\d+\.?\d*)\b/g, '<span class="text-blue-400">$1</span>');
          
          case 'json':
            return code
              .replace(/("(?:\\.|[^"\\])*")\s*:/g, '<span class="text-blue-400">$1</span>:')
              .replace(/:\s*("(?:\\.|[^"\\])*")/g, ': <span class="text-green-400">$1</span>')
              .replace(/:\s*(true|false|null)\b/g, ': <span class="text-orange-400">$1</span>')
              .replace(/:\s*(\d+\.?\d*)/g, ': <span class="text-blue-400">$1</span>');
          
          case 'bash':
          case 'shell':
            return code
              .replace(/^(#.*$)/gm, '<span class="text-gray-500">$1</span>')
              .replace(/\b(curl|wget|npm|pip|git|docker|cd|ls|mkdir|rm|cp|mv|chmod|sudo|echo|cat|grep|find|sed|awk)\b/g, '<span class="text-purple-400">$1</span>')
              .replace(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="text-green-400">$1$2$1</span>')
              .replace(/(-[a-zA-Z-]+)/g, '<span class="text-yellow-400">$1</span>');
          
          default:
            return code;
        }
      };

      codeRef.current.innerHTML = highlightCode(code, language);
    }
  }, [code, language]);

  return (
    <pre className={`overflow-x-auto ${className}`}>
      <code 
        ref={codeRef}
        className="text-sm text-gray-300 font-mono whitespace-pre block p-4"
      >
        {code}
      </code>
    </pre>
  );
}