'use client';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

// react-codemirror 依赖浏览器 DOM，用 next/dynamic 关闭 SSR，避免服务端渲染报错
const ReactCodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false });

export default function CodeEditor({ value, language, onChange, height = 300 }) {
  const extensions = useMemo(
    () => (language === 'python' ? [python()] : [javascript({ jsx: true })]),
    [language]
  );
  return (
    <ReactCodeMirror
      value={value}
      height={height}
      theme={oneDark}
      extensions={extensions}
      onChange={onChange}
      basicSetup={{ lineNumbers: true, highlightActiveLine: true, foldGutter: true, autocompletion: true, bracketMatching: true }}
      style={{ border: '1px solid #262b36', borderRadius: 6, fontSize: 13 }}
    />
  );
}
