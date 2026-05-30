

"use client";

import { useState, useRef, useEffect } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Heading,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Expand,
  Shrink,
  UploadCloud,
  FolderOpen,
  Bold,
  Italic,
  Youtube
} from "lucide-react";
import { cn } from "@/lib/utils";
import { storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { FileExplorer, SelectedFile } from "@/components/site/file-explorer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

marked.use({ breaks: true, gfm: true, pedantic: false });


interface MarkdownEditorProps {
    initialContent?: string;
    onContentChange: (content: string) => void;
}

export function MarkdownEditor({ initialContent = "", onContentChange }: MarkdownEditorProps) {
  const { toast } = useToast();
  const [content, setContent] = useState(initialContent);
  const [preview, setPreview] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [isYoutubeDialogOpen, setIsYoutubeDialogOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    // Debounce the markdown parsing and parent state update
    const handler = setTimeout(() => {
      const unsafeHTML = marked.parse(content) as string;
      // Add iframe to allowed tags for DOMPurify
      const cleanHTML = DOMPurify.sanitize(unsafeHTML, { ADD_TAGS: ["iframe"], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'] });
      setPreview(cleanHTML);
      onContentChange(content);
    }, 300); // 300ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [content, onContentChange]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  }

  const applyStyle = (prefix: string, suffix: string = prefix) => {
    const editor = editorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);
    
    const text = editor.value;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    let newContent;
    let newStart;
    let newEnd;

    if (selectedText) {
      newContent = `${before}${prefix}${selectedText}${suffix}${after}`;
      newStart = start + prefix.length;
      newEnd = end + prefix.length;
    } else {
      newContent = `${before}${prefix}${suffix}${after}`;
      newStart = newEnd = start + prefix.length;
    }

    setContent(newContent);
    
    setTimeout(() => {
      editor.focus();
      editor.selectionStart = newStart;
      editor.selectionEnd = newEnd;
    }, 0);
  };
  
  const insertAtCursor = (textToInsert: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newContent = before + textToInsert + after;
    setContent(newContent);

    // Restore focus and set cursor position
    setTimeout(() => {
      editor.focus();
      editor.selectionStart = editor.selectionEnd = start + textToInsert.length;
    }, 0);
  };
  
  const handleHeading = (level: number) => {
    const prefix = "#".repeat(level) + " ";
    insertAtCursor(prefix);
  };

  const handleBold = () => applyStyle("**");
  const handleItalic = () => applyStyle("*");
  const handleQuote = () => insertAtCursor("> ");
  const handleLink = () => applyStyle("[", "](url)");

  const handleFileExplorerSelect = (files: SelectedFile[]) => {
    if (files.length === 0) {
      setIsFileExplorerOpen(false);
      return;
    }
    const { url, name } = files[0];
    const markdownImage = `![${name}](${url})\n`;
    insertAtCursor(markdownImage);
    setIsFileExplorerOpen(false);
  }

  const handleYoutubeInsert = () => {
    const videoId = getYouTubeID(youtubeUrl);
    if (!videoId) {
        toast({ title: "Ugyldig YouTube URL", description: "Vennligst lim inn en gyldig YouTube-lenke.", variant: "destructive" });
        return;
    }

    const embedCode = `
<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; height: auto;">
  <iframe 
    src="https://www.youtube.com/embed/${videoId}" 
    frameborder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
    allowfullscreen 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
  ></iframe>
</div>
`;
    insertAtCursor(embedCode);
    setIsYoutubeDialogOpen(false);
    setYoutubeUrl("");
  };

  const getYouTubeID = (url: string) => {
    const a = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/);
    if(a) return a[1];
    return null;
  }

  const toggleFullscreen = () => {
    const elem = editorWrapperRef.current;
    if (!elem) return;

    if (!document.fullscreenElement) {
        elem.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <>
      <Card id="editor-wrapper" ref={editorWrapperRef} className={cn("relative transition-all duration-300 ease-in-out w-full h-full", isFullscreen && "fixed inset-0 z-50 !rounded-none")}>
        <CardContent className={cn("p-4 flex flex-col w-full h-full", isFullscreen ? "h-screen" : "")}>
          <div className="bg-muted p-2 rounded-t-lg border flex justify-between items-center z-10 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Heading className="mr-2 size-4" /> Headings
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuContent>
                    {[1, 2, 3, 4].map((level) => (
                      <DropdownMenuItem key={level} onSelect={() => handleHeading(level)}>
                        Heading {level}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenuPortal>
              </DropdownMenu>

              <Button variant="outline" size="sm" onClick={handleBold}>
                <Bold className="size-4" />
                <span className="sr-only">Bold</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleItalic}>
                <Italic className="size-4" />
                <span className="sr-only">Italic</span>
              </Button>

              <Button variant="outline" size="sm" onClick={handleQuote}>
                <Quote className="mr-2 size-4" /> Quote
              </Button>
              <Button variant="outline" size="sm" onClick={handleLink}>
                <LinkIcon className="mr-2 size-4" /> Link
              </Button>

              <Button variant="outline" size="sm" onClick={() => setIsFileExplorerOpen(true)}>
                <ImageIcon className="mr-2 size-4" /> Image
              </Button>

              <Button variant="outline" size="sm" onClick={() => setIsYoutubeDialogOpen(true)}>
                <Youtube className="mr-2 size-4" /> YouTube
              </Button>
            </div>
            <Button variant="outline" size="icon" onClick={toggleFullscreen}>
              {isFullscreen ? <Shrink className="size-4" /> : <Expand className="size-4" />}
            </Button>
          </div>

          <div className="grid md:grid-cols-2 flex-grow min-h-0 gap-4 mt-4">
            <div className="flex flex-col border rounded-lg overflow-hidden">
              <Textarea
                ref={editorRef}
                value={content}
                onChange={handleContentChange}
                className="w-full h-full resize-none border-0 rounded-none focus-visible:ring-0"
                placeholder="Start typing your markdown here..."
              />
            </div>
            <div className="hidden md:block border rounded-lg overflow-y-auto">
              <div
                className="prose dark:prose-invert max-w-none p-4"
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isFileExplorerOpen} onOpenChange={setIsFileExplorerOpen}>
        <DialogContent className="sm:max-w-7xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>File Explorer</DialogTitle>
            <DialogDescription>
              Select an image to insert into the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow min-h-0">
             <FileExplorer onFileSelect={handleFileExplorerSelect} isDialog={true} />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isYoutubeDialogOpen} onOpenChange={setIsYoutubeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Embed YouTube Video</DialogTitle>
            <DialogDescription>
              Paste the YouTube video URL below to embed it in your article.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="youtube-url" className="text-right">
                URL
              </Label>
              <Input
                id="youtube-url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="col-span-3"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsYoutubeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleYoutubeInsert}>Insert Video</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
