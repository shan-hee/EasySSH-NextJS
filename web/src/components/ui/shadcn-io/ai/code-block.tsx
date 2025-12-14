'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckIcon, CopyIcon } from 'lucide-react';
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import Prism from 'prismjs';

// 导入常用语言支持
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-docker';

// 语言别名映射
const languageAliases: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  yml: 'yaml',
  md: 'markdown',
  dockerfile: 'docker',
};

// 获取规范化的语言名称
const normalizeLanguage = (lang: string): string => {
  const normalized = lang.toLowerCase();
  return languageAliases[normalized] || normalized;
};

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: '',
});

export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  children?: ReactNode;
};

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const codeRef = useRef<HTMLElement>(null);
  const [highlightedCode, setHighlightedCode] = useState<string>('');
  const normalizedLang = normalizeLanguage(language);

  useEffect(() => {
    // 检查语言是否支持
    const grammar = Prism.languages[normalizedLang];
    if (grammar) {
      const highlighted = Prism.highlight(code, grammar, normalizedLang);
      setHighlightedCode(highlighted);
    } else {
      // 不支持的语言，直接显示原始代码
      setHighlightedCode(escapeHtml(code));
    }
  }, [code, normalizedLang]);

  // 生成行号
  const lines = code.split('\n');
  const lineNumbers = showLineNumbers ? (
    <span className="select-none pr-4 text-muted-foreground/60">
      {lines.map((_, i) => (
        <span key={i} className="block text-right min-w-[2rem]">
          {i + 1}
        </span>
      ))}
    </span>
  ) : null;

  return (
    <CodeBlockContext.Provider value={{ code }}>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-md border bg-background text-foreground',
          className
        )}
        {...props}
      >
        <div className="relative">
          <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
            <div className="flex">
              {lineNumbers}
              <code
                ref={codeRef}
                className={cn(
                  'prism-code flex-1',
                  `language-${normalizedLang}`
                )}
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
              />
            </div>
          </pre>
          {children && (
            <div className="absolute top-2 right-2 flex items-center gap-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </CodeBlockContext.Provider>
  );
};

// HTML 转义函数
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (typeof window === 'undefined' || !navigator.clipboard.writeText) {
      onError?.(new Error('Clipboard API not available'));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn('shrink-0', className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};
