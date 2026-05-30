
"use client";

import { useState } from "react";
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const MarkdownEditor = dynamic(
    () => import('@/components/site/markdown-editor').then(mod => mod.MarkdownEditor),
    { 
        ssr: false,
        loading: () => <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    }
);

export default function TextEditorPage() {
    const [content, setContent] = useState("**Hello world!**");

    return (
        <div className="h-[calc(100vh-10rem)]">
            <MarkdownEditor initialContent={content} onContentChange={setContent} />
        </div>
    );
}
