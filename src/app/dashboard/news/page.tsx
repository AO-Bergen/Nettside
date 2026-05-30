

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from "remark-breaks";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, AlertTriangle, FolderOpen, Trash2, X, User, CalendarIcon, Youtube, Loader2, Lock } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFirestore } from "@/firebase/index";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, Timestamp, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { format } from "date-fns";
import { nb } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownEditor } from "@/components/site/markdown-editor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileExplorer, SelectedFile } from "@/components/site/file-explorer";
import Image from "next/image";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandEmpty } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import rehypeRaw from "rehype-raw";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useDashboardPermissions } from "../layout";
import { ReadOnlyDialog } from "@/components/ui/read-only-dialog";

type User = {
  id: string;
  name: string;
  role: string;
};

type Article = {
  id: string;
  title: string;
  content: string;
  authors: string[];
  type: string;
  status: 'Kladd' | 'Publisert';
  date: Timestamp;
  imageUrl?: string;
  imageAttribution?: string;
  mediaHouse?: string;
  mediaLogoUrl?: string;
  originalArticleUrl?: string;
  mediaType?: 'Artikkel' | 'Video';
};

const articleTypes = ["Nyhetssak", "I media", "Pressemelding", "Leserinnlegg"];
const mediaTypes = ["Artikkel", "Video"];

const emptyArticle: Omit<Article, 'id'> = { 
    title: '', 
    content: '', 
    authors: [], 
    type: articleTypes[0], 
    status: 'Kladd',
    date: Timestamp.now(),
    imageUrl: '',
    imageAttribution: '',
    mediaHouse: '',
    mediaLogoUrl: '',
    originalArticleUrl: '',
    mediaType: 'Artikkel',
};

function DeleteArticleDialog({ articleToDelete, onConfirm, onCancel, hasWriteAccess, onReadOnly }: { articleToDelete: Article | null, onConfirm: () => void, onCancel: () => void, hasWriteAccess: boolean, onReadOnly: () => void }) {
    const [countdown, setCountdown] = useState(5);
    const [isCountingDown, setIsCountingDown] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startCountdown = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!hasWriteAccess) {
            onReadOnly();
            return;
        }
        setIsCountingDown(true);
        timerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    onConfirm();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const stopCountdown = () => {
        setIsCountingDown(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setCountdown(5);
    };

    const handleCancel = () => {
        stopCountdown();
        onCancel();
    }

    useEffect(() => {
        if (articleToDelete) {
            stopCountdown();
        }
    }, [articleToDelete]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return (
        <AlertDialog open={!!articleToDelete} onOpenChange={(open) => !open && handleCancel()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive"/>
                        Er du sikker?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                         Du er i ferd med å slette artikkelen: <strong>"{articleToDelete?.title}"</strong>. Handlingen kan ikke angres.
                         {isCountingDown && ` Sletter om ${countdown}...`}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleCancel} disabled={isCountingDown}>Avbryt</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={startCountdown} 
                        disabled={isCountingDown || !hasWriteAccess}
                        className={cn(buttonVariants({ variant: "destructive" }), isCountingDown && "bg-destructive/80")}
                    >
                         {isCountingDown ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Ja, slett permanent
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}


export default function NewsPage() {
  const firestore = useFirestore();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [imageTarget, setImageTarget] = useState<'main' | 'mediaLogo' | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Omit<Article, 'id'> & { id?: string }>(emptyArticle);
  const [isEditing, setIsEditing] = useState(false);
  const [authorInput, setAuthorInput] = useState("");
  const [articleToDelete, setArticleToDelete] = useState<Article | null>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const { permissions, isAdmin } = useDashboardPermissions();
  const [isReadOnlyDialogOpen, setIsReadOnlyDialogOpen] = useState(false);
  const hasWriteAccess = isAdmin || !!permissions?.news?.write;
  
  const handleWriteAttempt = (action?: () => void) => {
    if (!hasWriteAccess) {
      setIsReadOnlyDialogOpen(true);
    } else if (action){
      action();
    }
  };


  const sendNotification = async (articleId: string, articleTitle: string) => {
    try {
        const response = await fetch('/api/send-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: 'news', payload: { articleId, articleTitle } }),
        });
        if (response.ok) {
            toast({ title: "Varslinger sendes ut..."});
        } else if (response.status === 404) {
            console.warn("Push notification service (API route) is not available in static hosting environment.");
            toast({ 
                title: "Varsling ikke sendt", 
                description: "Push-varslingstjenesten er ikke tilgjengelig i denne statiske installasjonen.",
                variant: "default"
            });
        } else {
            const data = await response.json().catch(() => ({ message: `Feil ved kommunikasjon med server (status ${response.status})` }));
            throw new Error(data.message || 'Failed to trigger notifications.');
        }
    } catch (error: any) {
        toast({ title: "Kunne ikke starte utsending av varslinger", description: error.message, variant: "destructive" });
    }
  };


  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "news"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const articlesData: Article[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        articlesData.push({ 
            id: doc.id, 
            ...data, 
            authors: data.authors || (data.author ? [data.author] : [])
        } as Article);
      });
      setArticles(articlesData);

      const editId = searchParams.get('edit');
      if (editId) {
          const articleToEdit = articlesData.find(a => a.id === editId);
          if (articleToEdit) {
              handleOpenDialog(articleToEdit);
          }
      }
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: collection(firestore, "news").path,
            operation: 'list'
        });
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => {
        unsubscribe();
    }
  }, [firestore, searchParams]);
  
  const handleOpenDialog = (article?: Article) => {
    if (article) {
      setSelectedArticle({
        ...emptyArticle,
        ...article,
        authors: article.authors || ((article as any).author ? [(article as any).author] : [])
      });
      setIsEditing(true);
    } else {
      setSelectedArticle(emptyArticle);
      setIsEditing(false);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedArticle(emptyArticle);
    setAuthorInput("");
    setIsEditing(false);
  }

  const handleContentChange = useCallback((newContent: string) => {
    setSelectedArticle(prev => ({ ...prev!, content: newContent }));
  }, []);
  
  const handleFileSelect = (files: SelectedFile[]) => {
    if (files.length === 0) {
        setIsFileExplorerOpen(false);
        setImageTarget(null);
        return;
    }
    const { url, name, attribution } = files[0];

    if (imageTarget === 'main') {
        setSelectedArticle(prev => ({ 
            ...prev!, 
            imageUrl: url, 
            imageAttribution: prev.imageAttribution || attribution || ''
        }));
    } else if (imageTarget === 'mediaLogo') {
        setSelectedArticle(prev => ({ ...prev!, mediaLogoUrl: url }));
    }
    setIsFileExplorerOpen(false);
    setImageTarget(null);
  }

  const handleAddAuthor = (authorName: string) => {
      const trimmedName = authorName.trim();
      if(trimmedName && !selectedArticle.authors?.includes(trimmedName)) {
          setSelectedArticle(prev => ({...prev, authors: [...(prev.authors || []), trimmedName]}));
      }
      setAuthorInput("");
  }

  const handleRemoveAuthor = (authorName: string) => {
      setSelectedArticle(prev => ({...prev, authors: (prev.authors || []).filter(a => a !== authorName)}));
  }
  
  const handleAuthorInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          handleAddAuthor(authorInput);
      }
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
        date.setUTCHours(12, 0, 0, 0);
        setSelectedArticle(prev => ({...prev, date: Timestamp.fromDate(date)}));
    }
  }

  const handleSaveArticle = async (status: 'Kladd' | 'Publisert' = 'Kladd') => {
    if (!firestore) return;
    if (!selectedArticle.title) {
        toast({ title: "Tittel mangler", description: "Vennligst skriv inn en tittel for artikkelen.", variant: "destructive" });
        return;
    };
    if (!selectedArticle.authors || selectedArticle.authors.length === 0) {
        toast({ title: "Forfatter mangler", description: "Vennligst legg til minst én forfatter.", variant: "destructive" });
        return;
    }

    const articleToSave: any = { 
      ...selectedArticle, 
      status: status, 
    };
    
    if (articleToSave.type !== "I media") {
        articleToSave.mediaHouse = '';
        articleToSave.mediaLogoUrl = '';
        articleToSave.originalArticleUrl = '';
        articleToSave.mediaType = 'Artikkel';
    }
    
    delete articleToSave.author;

    if (isEditing && 'id' in articleToSave) {
        const articleDoc = doc(firestore, "news", articleToSave.id);
        const { id, ...articleData } = articleToSave;
        updateDoc(articleDoc, articleData).then(() => {
            toast({ title: "Artikkel oppdatert!", description: `Status: ${status}` });
            if (status === 'Publisert') {
                sendNotification(id, articleData.title);
            }
            handleCloseDialog();
        }).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: articleDoc.path,
                operation: 'update',
                requestResourceData: articleData
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    } else {
        const newsCollection = collection(firestore, "news");
        addDoc(newsCollection, articleToSave).then((docRef) => {
            toast({ title: "Artikkel opprettet!", description: `Status: ${status}` });
            if (status === 'Publisert') {
                sendNotification(docRef.id, articleToSave.title);
            }
            handleCloseDialog();
        }).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: newsCollection.path,
                operation: 'create',
                requestResourceData: articleToSave
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }
  };

 const handleDeleteArticle = async () => {
    if (!articleToDelete || !firestore) return;
    const articleDoc = doc(firestore, "news", articleToDelete.id);
    deleteDoc(articleDoc).then(() => {
        toast({ title: "Artikkel slettet." });
    }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: articleDoc.path,
            operation: 'delete'
        });
        errorEmitter.emit('permission-error', permissionError);
    }).finally(() => {
        setArticleToDelete(null);
    });
  };
  
  const handleStatusToggle = async (article: Article) => {
    if (!firestore) return;
    const articleDoc = doc(firestore, "news", article.id);
    const newStatus = article.status === 'Publisert' ? 'Kladd' : 'Publisert';
    if (newStatus === 'Publisert') {
        setSelectedArticle(article);
        setIsPublishConfirmOpen(true);
    } else {
        updateDoc(articleDoc, { status: newStatus }).then(() => {
            toast({ title: "Artikkelen er avpublisert."});
        }).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: articleDoc.path,
                operation: 'update',
                requestResourceData: { status: newStatus }
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }
  };
  
  const confirmPublish = async () => {
      await handleSaveArticle('Publisert');
      setIsPublishConfirmOpen(false);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle>Nyhetsadministrasjon</CardTitle>
            <CardDescription>Skriv og administrer nyhetsartikler.</CardDescription>
          </div>
          <Button size="sm" className="gap-1 w-full md:w-auto" onClick={() => handleWriteAttempt(() => handleOpenDialog())} disabled={!hasWriteAccess}>
            <PlusCircle className="h-4 w-4" />
            Ny Artikkel
          </Button>
        </CardHeader>
        <CardContent>
            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {articles.map((article) => (
                    <Card key={article.id} className="flex items-start gap-4 p-4">
                        {article.imageUrl ? (
                            <Image src={article.imageUrl} alt={article.title} width={64} height={64} className="flex-shrink-0 rounded-md object-cover aspect-square" unoptimized />
                        ) : (
                            <div className="flex-shrink-0 w-16 h-16 bg-muted rounded-md flex items-center justify-center text-muted-foreground text-xs text-center">No Image</div>
                        )}
                        <div className="flex-grow min-w-0">
                            <h3 className="font-semibold leading-snug">{article.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{format(article.date.toDate(), 'dd.MM.yyyy')}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="secondary">{article.type}</Badge>
                                <Badge variant={article.status === "Publisert" ? "default" : "outline"} className={article.status === 'Publisert' ? 'bg-primary text-primary-foreground' : ''}>
                                {article.status}
                                </Badge>
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Toggle menu</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Handlinger</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => handleWriteAttempt(() => handleOpenDialog(article))}>Rediger</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleWriteAttempt(() => handleStatusToggle(article))}>{article.status === 'Kladd' ? 'Publiser' : 'Avpubliser'}</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleWriteAttempt(() => setArticleToDelete(article))} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">Slett</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Desktop View */}
            <div className="w-full overflow-x-auto hidden md:block">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead className="w-[80px]">Bilde</TableHead>
                    <TableHead>Tittel</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Forfatter(e)</TableHead>
                    <TableHead>Dato</TableHead>
                    <TableHead><span className="sr-only">Handlinger</span></TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {articles.map((article) => (
                    <TableRow key={article.id}>
                    <TableCell>
                        {article.imageUrl ? (
                            <Image src={article.imageUrl} alt={article.title} width={64} height={64} className="rounded-md object-cover aspect-square" unoptimized />
                        ) : (
                            <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center text-muted-foreground text-xs text-center">No Image</div>
                        )}
                    </TableCell>
                    <TableCell className="font-medium">{article.title}</TableCell>
                    <TableCell>
                        <Badge variant="secondary">{article.type}</Badge>
                    </TableCell>
                    <TableCell>
                        <Badge variant={article.status === "Publisert" ? "default" : "outline"} className={article.status === 'Publisert' ? 'bg-primary text-primary-foreground' : ''}>
                        {article.status}
                        </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{(article.authors || []).join(', ')}</TableCell>
                    <TableCell>{article.date ? format(article.date.toDate(), 'dd.MM.yyyy') : ''}</TableCell>
                    <TableCell>
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Handlinger</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleWriteAttempt(() => handleOpenDialog(article))}>Rediger</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleWriteAttempt(() => handleStatusToggle(article))}>{article.status === 'Kladd' ? 'Publiser' : 'Avpubliser'}</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleWriteAttempt(() => setArticleToDelete(article))} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">Slett</DropdownMenuItem>
                        </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader className="text-left">
            <DialogTitle>{isEditing ? 'Rediger artikkel' : 'Ny artikkel'}</DialogTitle>
            <DialogDescription>
                {isEditing ? `Endre detaljene for artikkelen.` : `Fyll ut detaljene for den nye artikkelen.`}
            </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                <div className="grid gap-4 py-4 pr-2">
                    <div className="space-y-2">
                    <Label htmlFor="title">Tittel</Label>
                    <Input id="title" value={selectedArticle.title} onChange={(e) => setSelectedArticle({ ...selectedArticle, title: e.target.value })} />
                    </div>

                    <div className="space-y-4">
                        <Label>Hovedbilde</Label>
                        <div className="flex items-center gap-4">
                            {selectedArticle.imageUrl ? (
                            <Image src={selectedArticle.imageUrl} alt="Article image" width={100} height={100} className="rounded-md border aspect-video object-cover" unoptimized />
                            ) : (
                            <div className="w-[100px] h-[100px] bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">Ingen bilde</div>
                            )}
                            <div className="flex flex-col gap-2">
                            <Button variant="outline" onClick={() => { setIsFileExplorerOpen(true); setImageTarget('main') }}>
                                <FolderOpen className="mr-2 h-4 w-4" />
                                Velg bilde
                            </Button>
                            {selectedArticle.imageUrl && (
                                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setSelectedArticle({ ...selectedArticle, imageUrl: '' })}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Fjern bilde
                                </Button>
                            )}
                            </div>
                        </div>
                    </div>


                    <div className="space-y-2">
                        <Label htmlFor="imageAttribution">Bildekreditering</Label>
                        <Input id="imageAttribution" value={selectedArticle.imageAttribution || ''} onChange={(e) => setSelectedArticle({ ...selectedArticle, imageAttribution: e.target.value })} placeholder="F.eks. Fotografens Navn / Kilde" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Artikkeltype</Label>
                        <Select onValueChange={(value) => setSelectedArticle({ ...selectedArticle, type: value })} value={selectedArticle.type}>
                        <SelectTrigger><SelectValue placeholder="Velg type" /></SelectTrigger>
                        <SelectContent>
                            {articleTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Dato</Label>
                        <Popover>
                        <PopoverTrigger asChild>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !selectedArticle.date && "text-muted-foreground"
                            )}
                            >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedArticle.date ? format(selectedArticle.date.toDate(), "PPP", { locale: nb }) : <span>Velg dato</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                            mode="single"
                            selected={selectedArticle.date.toDate()}
                            onSelect={handleDateSelect}
                            initialFocus
                            locale={nb}
                            />
                        </PopoverContent>
                        </Popover>
                    </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Forfatter(e)</Label>
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                            {(selectedArticle.authors || []).map(author => (
                                <Badge key={author} variant="secondary" className="gap-1.5 pr-1.5">
                                {author}
                                <button onClick={() => handleRemoveAuthor(author)} className="rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                                    <X className="h-3 w-3" />
                                </button>
                                </Badge>
                            ))}
                            </div>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={authorInput}
                                    onChange={(e) => setAuthorInput(e.target.value)}
                                    onKeyDown={handleAuthorInputKeyDown}
                                    placeholder="Legg til forfatter og trykk Enter..."
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </div>


                    {selectedArticle.type === 'I media' && (
                    <div className="space-y-4 pt-4 mt-4 border-t">
                        <h3 className="font-medium">Detaljer for "I media"</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Mediatype</Label>
                                <Select onValueChange={(value: 'Artikkel' | 'Video') => setSelectedArticle({ ...selectedArticle, mediaType: value })} value={selectedArticle.mediaType}>
                                <SelectTrigger><SelectValue placeholder="Velg mediatype" /></SelectTrigger>
                                <SelectContent>
                                    {mediaTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mediaHouse">Mediehus</Label>
                                <Input id="mediaHouse" placeholder="F.eks. Bergens Tidende" value={selectedArticle.mediaHouse} onChange={(e) => setSelectedArticle({ ...selectedArticle, mediaHouse: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Mediehusets Logo</Label>
                            <div className="flex items-center gap-4">
                            {selectedArticle.mediaLogoUrl ? (
                                <Image src={selectedArticle.mediaLogoUrl} alt="Mediehus logo" width={100} height={40} className="rounded-md border object-contain p-1" unoptimized />
                            ) : (
                                <div className="w-[100px] h-[40px] bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">Ingen logo</div>
                            )}
                            <div className="flex flex-col gap-2">
                                <Button variant="outline" size="sm" onClick={() => { setIsFileExplorerOpen(true); setImageTarget('mediaLogo') }}>
                                <FolderOpen className="mr-2 h-4 w-4" /> Velg logo
                                </Button>
                                {selectedArticle.mediaLogoUrl && (
                                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setSelectedArticle({ ...selectedArticle, mediaLogoUrl: '' })}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Fjern logo
                                </Button>
                                )}
                            </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                        <Label htmlFor="originalArticleUrl">Lenke til Originalartikkel</Label>
                        <Input id="originalArticleUrl" placeholder="https://..." value={selectedArticle.originalArticleUrl} onChange={(e) => setSelectedArticle({ ...selectedArticle, originalArticleUrl: e.target.value })} />
                        </div>
                    </div>
                    )}

                    <div className="space-y-2 pt-4">
                    <Label htmlFor="content">Innhold</Label>
                    <div className="h-[500px] border rounded-md">
                        <MarkdownEditor
                        initialContent={selectedArticle.content}
                        onContentChange={handleContentChange}
                        />
                    </div>
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={handleCloseDialog}>Avbryt</Button>
            <Button variant="secondary" onClick={() => handleWriteAttempt(() => handleSaveArticle('Kladd'))} disabled={!hasWriteAccess}>Lagre som kladd</Button>
            <Button variant="default" onClick={() => handleWriteAttempt(() => setIsPublishConfirmOpen(true))} disabled={!hasWriteAccess}>Publiser</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isFileExplorerOpen} onOpenChange={setIsFileExplorerOpen}>
        <DialogContent className="sm:max-w-7xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>File Explorer</DialogTitle>
            <DialogDescription>
              Select an image.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow min-h-0">
            <FileExplorer onFileSelect={handleFileSelect} isDialog={true} />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isPublishConfirmOpen} onOpenChange={setIsPublishConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="text-destructive" />
                    Er du sikker på at du vil publisere?
                </AlertDialogTitle>
                <AlertDialogDescription>
                    Dette vil gjøre artikkelen tilgjengelig for alle som besøker nettsiden.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleWriteAttempt(confirmPublish)} disabled={!hasWriteAccess}>Ja, publiser</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteArticleDialog
        articleToDelete={articleToDelete}
        onConfirm={handleDeleteArticle}
        onCancel={() => setArticleToDelete(null)}
        hasWriteAccess={hasWriteAccess}
        onReadOnly={() => { setArticleToDelete(null); setIsReadOnlyDialogOpen(true); }}
      />
      <ReadOnlyDialog isOpen={isReadOnlyDialogOpen} onOpenChange={setIsReadOnlyDialogOpen} />
    </>
  );
}
