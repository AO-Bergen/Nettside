
"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const FileExplorer = dynamic(
    () => import('@/components/site/file-explorer').then(mod => mod.FileExplorer),
    { 
        ssr: false,
        loading: () => <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    }
);

export default function FileExplorerPage() {
    return (
       <div className="flex-1 min-h-0">
         <FileExplorer onFileSelect={() => {}} />
       </div>
    )
}
