

"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, Facebook, Instagram, Twitter, Loader2, Upload, FolderOpen, Trash2, ArrowUp, ArrowDown, Copy, Download as DownloadIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useStorage } from "@/firebase/index";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject, getBlob } from "firebase/storage";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileExplorer, SelectedFile } from "@/components/site/file-explorer";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { MarkdownEditor } from "@/components/site/markdown-editor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";

const platforms = ["Facebook", "Instagram", "Twitter"];
const statuses = ["Planlagt", "Publisert", "Arkivert"];

type Post = {
  id: string;
  platform: string;
  content: string;
  plan: string;
  responsible: string;
  scheduleDate: string; 
  status: string;
  imageUrls?: string[];
};

const emptyPost: Omit<Post, 'id'> = {
  platform: '',
  content: '',
  plan: '',
  responsible: '',
  scheduleDate: '',
  status: 'Planlagt',
  imageUrls: [],
};

const PlatformIcon = ({ platform }: { platform: string }) => {
    switch (platform?.toLowerCase()) {
        case 'facebook': return <Facebook className="w-4 h-4" />;
        case 'instagram': return <Instagram className="w-4 h-4" />;
        case 'twitter': return <Twitter className="w-4 h-4" />;
        default: return null;
    }
}

async function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            let { width, height } = img;
            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas to Blob conversion failed'));
                }
            }, file.type, 0.9);
        };
        img.onerror = reject;
    });
}


export default function SocialPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | Omit<Post, 'id'>>(emptyPost);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "socialPosts"), orderBy("scheduleDate", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const postsData: Post[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        postsData.push({ 
            id: doc.id, 
            ...data,
            imageUrls: data.imageUrls || (data.imageUrl ? [data.imageUrl] : [])
        } as Post);
      });
      setPosts(postsData);
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: collection(firestore, "socialPosts").path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    return () => unsubscribe();
  }, [firestore, toast]);
  
  const handleRowClick = (post: Post) => {
    setSelectedPost(post);
    setIsViewDialogOpen(true);
  }
  
  const handleCopyText = () => {
    if (selectedPost.content) {
      navigator.clipboard.writeText(selectedPost.content);
      toast({ title: "Tekst kopiert!" });
    }
  }

  const handleDownloadImage = async (url: string, name: string) => {
      try {
        const blob = await fetch(url).then(r => r.blob());
        saveAs(blob, name);
      } catch (error: any) {
        console.error("Error downloading image:", error);
        toast({
            title: "Nedlasting feilet",
            description: "Kunne ikke laste ned bildet. Prøv å høyreklikke og lagre.",
            variant: "destructive",
        });
      }
  }

  const handleOpenDialog = (post?: Post) => {
    if (post) {
      setSelectedPost({
        ...post,
        plan: post.plan || '',
        imageUrls: post.imageUrls || ((post as any).imageUrl ? [(post as any).imageUrl] : [])
      });
      setIsEditing(true);
    } else {
      setSelectedPost(emptyPost);
      setIsEditing(false);
    }
    setIsDialogOpen(true);
  };
  
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setIsViewDialogOpen(false);
    setSelectedPost(emptyPost);
    setIsEditing(false);
    setIsUploading(false);
  };
  
  const handlePlanChange = useCallback((newPlan: string) => {
    setSelectedPost(prev => ({ ...prev, plan: newPlan }));
  }, []);

  const handleImageUpload = async (file: File) => {
    if (!storage) return;
    setIsUploading(true);
    try {
        const resizedImageBlob = await resizeImage(file, 1080, 1080);
        const sRef = storageRef(storage, `social/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(sRef, resizedImageBlob);
        
        await uploadTask;
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

        setSelectedPost(prev => ({ ...prev, imageUrls: [...(prev.imageUrls || []), downloadURL] }));
        toast({ title: "Bilde lastet opp", description: "Bildet er lagt til i innlegget." });
    } catch(error) {
        toast({ title: "Opplasting feilet", variant: "destructive" });
        console.error("Image upload failed", error);
    } finally {
        setIsUploading(false);
    }
  };

  const handleFileSelect = (files: SelectedFile[]) => {
    const urls = files.map(file => file.url);
    setSelectedPost(prev => ({ ...prev, imageUrls: [...(prev.imageUrls || []), ...urls] }));
    setIsFileExplorerOpen(false);
  };
  
  const handleRemoveImage = (indexToRemove: number) => {
    setSelectedPost(prev => ({
        ...prev,
        imageUrls: (prev.imageUrls || []).filter((_, index) => index !== indexToRemove)
    }));
  }

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    const currentUrls = selectedPost.imageUrls || [];
    if (direction === 'up' && index > 0) {
        const newUrls = [...currentUrls];
        [newUrls[index - 1], newUrls[index]] = [newUrls[index], newUrls[index - 1]];
        setSelectedPost(prev => ({ ...prev, imageUrls: newUrls }));
    } else if (direction === 'down' && index < currentUrls.length - 1) {
        const newUrls = [...currentUrls];
        [newUrls[index + 1], newUrls[index]] = [newUrls[index], newUrls[index + 1]];
        setSelectedPost(prev => ({ ...prev, imageUrls: newUrls }));
    }
  }


  const handleSavePost = async () => {
    if (!firestore) return;
    if (!selectedPost.platform || !selectedPost.content || !selectedPost.scheduleDate) {
        toast({ title: "Mangler informasjon", description: "Plattform, innhold og dato må fylles ut.", variant: "destructive"});
        return;
    }
    
    setIsUploading(true);

    const postData: any = {
      ...selectedPost,
    };
    delete postData.imageUrl;

    if (isEditing && 'id' in selectedPost) {
      const postDoc = doc(firestore, "socialPosts", selectedPost.id);
      const { id, ...dataToUpdate } = postData;
      updateDoc(postDoc, dataToUpdate).then(() => {
        toast({ title: "Innlegg oppdatert!" });
        handleCloseDialog();
      }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: postDoc.path,
            operation: 'update',
            requestResourceData: dataToUpdate
        });
        errorEmitter.emit('permission-error', permissionError);
      }).finally(() => setIsUploading(false));
    } else {
        const postsCollection = collection(firestore, "socialPosts");
        addDoc(postsCollection, postData).then(() => {
            toast({ title: "Innlegg opprettet!" });
            handleCloseDialog();
        }).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: postsCollection.path,
                operation: 'create',
                requestResourceData: postData
            });
            errorEmitter.emit('permission-error', permissionError);
        }).finally(() => setIsUploading(false));
    }
  };
  
  const handleDeletePost = async (post: Post) => {
      if (!firestore) return;
      const postDoc = doc(firestore, "socialPosts", post.id);
      deleteDoc(postDoc).then(() => {
          toast({ title: "Innlegg slettet." });
      }).catch((serverError) => {
          const permissionError = new FirestorePermissionError({
              path: postDoc.path,
              operation: 'delete'
          });
          errorEmitter.emit('permission-error', permissionError);
      });
  };
  
  return (
    <>
      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle>SoMe Planlegger</CardTitle>
            <CardDescription>Planlegg og spor innlegg på sosiale medier.</CardDescription>
          </div>
          <Button size="sm" className="gap-1 w-full md:w-auto" onClick={() => handleOpenDialog()}>
            <PlusCircle className="h-4 w-4" />
            Nytt Innlegg
          </Button>
        </CardHeader>
        <CardContent>
            {/* Mobile View */}
            <div className="md:hidden space-y-4">
                {posts.map((post) => (
                    <Card key={post.id} className="p-4">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-grow min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <PlatformIcon platform={post.platform} />
                                    <span className="font-semibold">{post.platform}</span>
                                    <span className="text-muted-foreground">&middot;</span>
                                    <span className="text-sm text-muted-foreground">{post.scheduleDate ? format(parseISO(post.scheduleDate), 'dd.MM.yy') : ''}</span>
                                </div>
                                <p className="text-sm">{post.content}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant={post.status === "Publisert" ? "default" : "outline"} className={cn(post.status === "Publisert" ? 'bg-primary text-primary-foreground' : '')}>
                                        {post.status}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{post.responsible}</span>
                                </div>
                            </div>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Toggle menu</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Handlinger</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => handleRowClick(post)}>Vis</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenDialog(post)}>Rediger</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeletePost(post)} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">Slett</DropdownMenuItem>
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
                    <TableHead className="w-[100px]">Bilde</TableHead>
                    <TableHead>Plattform</TableHead>
                    <TableHead>Innhold</TableHead>
                    <TableHead>Ansvarlig</TableHead>
                    <TableHead>Planlagt Dato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead><span className="sr-only">Handlinger</span></TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {posts.map((post) => (
                    <TableRow key={post.id}>
                    <TableCell>
                        <button onClick={() => handleRowClick(post)} className="cursor-pointer">
                            {post.imageUrls && post.imageUrls.length > 0 ? (
                            <div className="relative w-16 h-16">
                                <Image
                                    src={post.imageUrls[0]}
                                    alt="Post image"
                                    width={64}
                                    height={64}
                                    className="rounded-md object-cover aspect-square"
                                    unoptimized
                                />
                                {post.imageUrls.length > 1 && (
                                    <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                        +{post.imageUrls.length -1}
                                    </div>
                                )}
                            </div>
                            ) : (
                            <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
                                <span className="text-xs">No image</span>
                            </div>
                            )}
                        </button>
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <PlatformIcon platform={post.platform} />
                            <span>{post.platform}</span>
                        </div>
                    </TableCell>
                    <TableCell className="font-medium max-w-xs truncate">
                        <button onClick={() => handleRowClick(post)} className="font-medium text-left hover:underline">
                            {post.content}
                        </button>
                    </TableCell>
                    <TableCell>{post.responsible}</TableCell>
                    <TableCell>
                        {post.scheduleDate ? format(parseISO(post.scheduleDate), 'dd.MM.yyyy') : ''}
                    </TableCell>
                    <TableCell>
                        <Badge variant={post.status === "Publisert" ? "default" : "outline"} className={cn(post.status === "Publisert" ? 'bg-primary text-primary-foreground' : '', "cursor-pointer")}>
                        {post.status}
                        </Badge>
                    </TableCell>
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
                            <DropdownMenuItem onClick={() => handleOpenDialog(post)}>Rediger</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeletePost(post)} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">Slett</DropdownMenuItem>
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

      <Dialog open={isViewDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Forhåndsvisning av innlegg</DialogTitle>
             <DialogDescription>
                Planlagt for {selectedPost.platform} den {selectedPost.scheduleDate ? format(parseISO(selectedPost.scheduleDate), "dd.MM.yyyy") : ''}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="-mx-6 max-h-[70vh] px-6">
            <div className="space-y-4 pr-2">
              <div>
                <Label className="font-semibold">Innhold</Label>
                <div className="mt-2 relative rounded-md border p-3 bg-muted/50 text-sm whitespace-pre-wrap">
                  {selectedPost.content}
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyText} className="mt-2">
                  <Copy className="mr-2 h-4 w-4" /> Kopier tekst
                </Button>
              </div>

              <div>
                <Label className="font-semibold">Bilder</Label>
                <div className="mt-2 space-y-2">
                  {(selectedPost.imageUrls || []).map((url, index) => (
                    <div key={index} className="flex items-center justify-between gap-4 p-2 border rounded-lg bg-background">
                      <div className="flex items-center gap-4">
                        <Image src={url} alt={`Bilde ${index + 1}`} width={60} height={60} className="rounded-md object-cover aspect-square"/>
                        <span className="text-xs text-muted-foreground">Bilde {index + 1}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDownloadImage(url, `image_${index + 1}`)}>
                        <DownloadIcon className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPost.plan && (
                 <div className="pt-4 mt-4 border-t">
                    <Label className="font-semibold">Plan for innlegget</Label>
                     <div className="prose dark:prose-invert max-w-none mt-2 text-sm text-muted-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>{selectedPost.plan}</ReactMarkdown>
                    </div>
                </div>
               )}
            </div>
          </ScrollArea>
           <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>Lukk</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                  <DialogTitle>{isEditing ? 'Rediger innlegg' : 'Nytt innlegg'}</DialogTitle>
                  <DialogDescription>
                      {isEditing ? 'Endre detaljene for innlegget.' : 'Planlegg et nytt innlegg for sosiale medier.'}
                  </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                  <div className="grid gap-4 py-4 pr-2">
                      <div className="space-y-2">
                          <Label htmlFor="platform">Plattform</Label>
                          <Select onValueChange={(value) => setSelectedPost({ ...selectedPost, platform: value })} value={selectedPost.platform}>
                              <SelectTrigger><SelectValue placeholder="Velg plattform" /></SelectTrigger>
                              <SelectContent>
                                  {platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>

                      <div className="space-y-2">
                          <Label>Bilder</Label>
                          <Card className="p-4 bg-muted/50">
                              <div className="space-y-4">
                                  {(selectedPost.imageUrls || []).map((url, index) => (
                                      <div key={index} className="flex items-center gap-4 p-2 border rounded-lg bg-background">
                                          <Image src={url} alt={`Bilde ${index + 1}`} width={60} height={60} className="rounded-md object-cover aspect-square"/>
                                          <div className="flex-grow text-xs text-muted-foreground truncate">{typeof url === 'string' ? url.split('%2F').pop()?.split('?')[0] : 'Behandler...'}</div>
                                          <div className="flex flex-col gap-1">
                                              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => handleMoveImage(index, 'up')}>
                                                  <ArrowUp className="h-4 w-4"/>
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === (selectedPost.imageUrls?.length || 0) - 1} onClick={() => handleMoveImage(index, 'down')}>
                                                  <ArrowDown className="h-4 w-4"/>
                                              </Button>
                                          </div>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveImage(index)}>
                                              <Trash2 className="h-4 w-4"/>
                                          </Button>
                                      </div>
                                  ))}
                              </div>
                              
                              {isUploading && (
                                  <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                                      <Loader2 className="h-4 w-4 animate-spin" /> Laster opp...
                                  </div>
                              )}

                              <div className="flex gap-2 mt-4 pt-4 border-t">
                                  <Input 
                                  id="image-upload" 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])} 
                                  className="hidden" 
                                  />
                                  <Button asChild variant="outline" className="flex-1">
                                  <label htmlFor="image-upload" className="cursor-pointer">
                                          <Upload className="mr-2 h-4 w-4" />
                                          Last opp nytt
                                  </label>
                                  </Button>
                                  <Button variant="outline" className="flex-1" onClick={() => setIsFileExplorerOpen(true)}>
                                      <FolderOpen className="mr-2 h-4 w-4" />
                                      Velg fra filutforsker
                                  </Button>
                              </div>
                          </Card>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="content">Innhold</Label>
                        <Textarea
                            id="content"
                            value={selectedPost.content}
                            onChange={(e) => setSelectedPost({ ...selectedPost, content: e.target.value })}
                            placeholder="Skriv innlegget ditt her..."
                            rows={6}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="responsible">Ansvarlig</Label>
                          <Input id="responsible" value={selectedPost.responsible} onChange={(e) => setSelectedPost({ ...selectedPost, responsible: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="scheduleDate">Planlagt dato</Label>
                          <Input id="scheduleDate" type="date" value={selectedPost.scheduleDate} onChange={(e) => setSelectedPost({ ...selectedPost, scheduleDate: e.target.value })} />
                      </div>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="status">Status</Label>
                          <Select onValueChange={(value) => setSelectedPost({ ...selectedPost, status: value })} value={selectedPost.status}>
                              <SelectTrigger><SelectValue placeholder="Velg status" /></SelectTrigger>
                              <SelectContent>
                                  {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="plan">Plan for innlegget</Label>
                         <div className="h-[300px] border rounded-md">
                            <MarkdownEditor
                                initialContent={selectedPost.plan}
                                onContentChange={handlePlanChange}
                            />
                        </div>
                      </div>
                  </div>
              </ScrollArea>
              <DialogFooter>
                  <Button variant="outline" onClick={handleCloseDialog} disabled={isUploading}>Avbryt</Button>
                  <Button onClick={handleSavePost} disabled={isUploading}>
                      {isUploading ? 'Lagrer...' : 'Lagre'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      <Dialog open={isFileExplorerOpen} onOpenChange={setIsFileExplorerOpen}>
        <DialogContent className="sm:max-w-7xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>File Explorer</DialogTitle>
            <DialogDescription>
              Select an image for the social media post.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow min-h-0">
             <FileExplorer onFileSelect={handleFileSelect} isDialog={true} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
