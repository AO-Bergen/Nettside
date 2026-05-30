

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreVertical, PlusCircle, FolderOpen, Trash2, Link2, GripVertical, Save, ImageOff, Edit, Lock, Unlock } from "lucide-react";
import { useFirestore } from "@/firebase/index";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, Timestamp, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { FileExplorer, SelectedFile } from "@/components/site/file-explorer";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import Link from "next/link";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";


type InstagramLink = {
  id: string;
  imageUrl: string;
  destinationUrl: string;
  createdAt: Timestamp;
  order: number;
  isLocked?: boolean;
};

const emptyLink: Omit<InstagramLink, 'id' | 'createdAt' | 'order'> = {
  imageUrl: '',
  destinationUrl: '',
  isLocked: false,
};

export default function InstagramLinksPage() {
  const firestore = useFirestore();
  const [links, setLinks] = useState<InstagramLink[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<Omit<InstagramLink, 'id' | 'createdAt' | 'order'> & { id?: string }>(emptyLink);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "instagramLinks"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const linksData: InstagramLink[] = [];
       snapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            linksData.push({ 
                id: doc.id, 
                ...data,
                order: typeof data.order === 'number' ? data.order : index
            } as InstagramLink);
        });
      linksData.sort((a, b) => a.order - b.order);
      setLinks(linksData);
    }, (error) => {
      const permissionError = new FirestorePermissionError({
        path: collection(firestore, "instagramLinks").path,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
    });
    return () => unsubscribe();
  }, [firestore]);

  const handleOpenDialog = (link?: InstagramLink) => {
    if (link) {
      setSelectedLink(link);
      setIsEditing(true);
    } else {
      setSelectedLink(emptyLink);
      setIsEditing(false);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedLink(emptyLink);
    setIsEditing(false);
  };

  const handleFileSelect = (files: SelectedFile[]) => {
    if (files.length > 0) {
      setSelectedLink(prev => ({ ...prev, imageUrl: files[0].url }));
    }
    setIsFileExplorerOpen(false);
  };

  const handleSave = async () => {
    if (!firestore) return;
    const dataToSave: Partial<InstagramLink> = {
      imageUrl: selectedLink.imageUrl || '',
      destinationUrl: selectedLink.destinationUrl || '',
      isLocked: selectedLink.isLocked || false,
    };

    if (isEditing && selectedLink.id) {
      const linkDoc = doc(firestore, "instagramLinks", selectedLink.id);
      updateDoc(linkDoc, dataToSave)
        .then(() => {
          toast({ title: "Lenke oppdatert!" });
          handleCloseDialog();
        })
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: linkDoc.path,
            operation: 'update',
            requestResourceData: dataToSave,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    } else {
      const newOrder = links.length > 0 ? Math.min(...links.map(l => l.order)) - 1 : 0;
      const fullData = {
        ...dataToSave,
        createdAt: Timestamp.now(),
        order: newOrder,
      };
      const linksCollection = collection(firestore, "instagramLinks");
      addDoc(linksCollection, fullData)
        .then(() => {
          toast({ title: "Nytt element opprettet!" });
          handleCloseDialog();
        })
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: linksCollection.path,
            operation: 'create',
            requestResourceData: fullData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    }
  };

  const handleDelete = (linkId: string) => {
      if (!firestore) return;
      const linkDoc = doc(firestore, "instagramLinks", linkId);
      deleteDoc(linkDoc)
        .then(() => {
          toast({ title: "Element slettet." });
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: linkDoc.path,
              operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  };

   const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;

    let _links = [...links];
    // The item being dragged
    const draggedItem = _links.splice(dragItem.current, 1)[0];
    // Insert it at the new position
    _links.splice(dragOverItem.current, 0, draggedItem);
    
    // Reset refs
    dragItem.current = null;
    dragOverItem.current = null;

    setLinks(_links);
  };
  
  const handleSaveOrder = async () => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    links.forEach((link, index) => {
      const docRef = doc(firestore, "instagramLinks", link.id);
      batch.update(docRef, { order: index });
    });

    try {
      await batch.commit();
      toast({ title: "Rekkefølge lagret!" });
    } catch (e) {
      toast({ title: "Feil ved lagring av rekkefølge", variant: "destructive" });
      console.error(e);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle>Instagram Lenker</CardTitle>
            <CardDescription>Administrer lenkene for /bio-siden. Dra og slipp for å endre rekkefølge.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1 w-full md:w-auto" onClick={handleSaveOrder}>
                <Save className="h-4 w-4" />
                Lagre Rekkefølge
            </Button>
            <Button size="sm" className="gap-1 w-full md:w-auto" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-4 w-4" />
                Nytt element
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {links.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {links.map((link, index) => (
                <div 
                    key={link.id} 
                    className={cn("group relative", !link.isLocked && "cursor-move")}
                    draggable={!link.isLocked}
                    onDragStart={!link.isLocked ? () => (dragItem.current = index) : undefined}
                    onDragEnter={!link.isLocked ? () => (dragOverItem.current = index) : undefined}
                    onDragEnd={handleSort}
                    onDragOver={(e) => e.preventDefault()}
                >
                   <div className="relative aspect-square w-full h-full overflow-hidden rounded-md border bg-muted">
                        {link.imageUrl ? (
                           <Link href={link.destinationUrl || '#'} target={link.destinationUrl ? '_blank' : '_self'} rel="noopener noreferrer" className="block w-full h-full cursor-pointer">
                                <Image
                                src={link.imageUrl}
                                alt="Instagram post"
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                unoptimized
                                />
                            </Link>
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted border-dashed border-2">
                                <ImageOff className="h-10 w-10 text-muted-foreground/50" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        {!link.isLocked && (
                           <GripVertical className="absolute top-1/2 left-1 -translate-y-1/2 h-6 w-6 text-white opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none" />
                        )}

                        {link.isLocked && (
                            <Lock className="absolute top-2 left-2 h-5 w-5 text-white/70 bg-black/30 p-1 rounded-sm" />
                        )}
                        
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(link)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" className="h-8 w-8">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Denne handlingen kan ikke angres. Dette vil permanent slette elementet.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(link.id)}>Ja, slett</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                        
                         {link.destinationUrl && (
                             <a href={link.destinationUrl} target="_blank" rel="noopener noreferrer" className="absolute bottom-1 left-1 right-1 bg-black/50 text-white text-xs p-1 rounded-sm truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                {link.destinationUrl}
                            </a>
                         )}
                    </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p>Ingen elementer er lagt til enda. Trykk på "Nytt Element" for å starte.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Rediger element' : 'Nytt element'}</DialogTitle>
            <DialogDescription>
                Du kan lage en klikkbar lenke med bilde, eller la feltene stå tomme for å lage en plassholder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="space-y-4">
                <Label>Bilde (valgfritt)</Label>
                <div className="flex items-center gap-4">
                    {selectedLink.imageUrl ? (
                        <Image src={selectedLink.imageUrl} alt="Valgt bilde" width={100} height={100} className="rounded-md border aspect-square object-cover" unoptimized/>
                    ) : (
                        <div className="w-[100px] h-[100px] bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">Ingen bilde valgt</div>
                    )}
                     <Button variant="outline" onClick={() => setIsFileExplorerOpen(true)}>
                      <FolderOpen className="mr-2 h-4 w-4" /> Velg bilde
                    </Button>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="imageUrl">eller lim inn bilde-URL</Label>
                    <Input 
                        id="imageUrl" 
                        value={selectedLink.imageUrl || ''} 
                        onChange={(e) => setSelectedLink(prev => ({...prev, imageUrl: e.target.value}))} 
                        placeholder="https://..."
                    />
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="destinationUrl">Destinasjons-URL (valgfritt)</Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="destinationUrl"
                  value={selectedLink.destinationUrl || ''}
                  onChange={(e) => setSelectedLink(prev => ({ ...prev, destinationUrl: e.target.value }))}
                  placeholder="https://... "
                  className="pl-9"
                />
              </div>
            </div>
             <div className="flex items-center space-x-2 pt-4 border-t">
                <Switch 
                    id="isLocked" 
                    checked={selectedLink.isLocked} 
                    onCheckedChange={(checked) => setSelectedLink(prev => ({ ...prev, isLocked: checked }))}
                />
                <Label htmlFor="isLocked">Lås rekkefølge</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Avbryt</Button>
            <Button onClick={handleSave}>Lagre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFileExplorerOpen} onOpenChange={setIsFileExplorerOpen}>
        <DialogContent className="sm:max-w-7xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Velg et bilde</DialogTitle>
          </DialogHeader>
          <div className="flex-grow min-h-0">
            <FileExplorer onFileSelect={handleFileSelect} isDialog={true} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
