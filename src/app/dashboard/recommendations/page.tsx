
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { PlusCircle, FolderOpen, Trash2, Edit, Save, ArrowDown, ArrowUp, X, Link as LinkIcon, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore } from "@/firebase/index";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { FileExplorer, SelectedFile } from "@/components/site/file-explorer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { cn } from "@/lib/utils";

type RecommendationType = "book" | "documentary" | "podcast";

const recommendationTypes: { value: RecommendationType; label: string }[] = [
  { value: "book", label: "Bok" },
  { value: "documentary", label: "Dokumentar/Video" },
  { value: "podcast", label: "Podcast" },
];

type Recommendation = {
  id: string;
  title: string;
  creator: string;
  description: string;
  imageUrl: string;
  type: RecommendationType;
  aiHint: string;
  order: number;
  linkUrl?: string;
};

const emptyRec: Omit<Recommendation, "id" | "order"> = {
  title: "",
  creator: "",
  description: "",
  imageUrl: "",
  type: "book",
  aiHint: "",
  linkUrl: "",
};

export default function RecommendationsPage() {
  const firestore = useFirestore();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRec, setSelectedRec] = useState<Omit<Recommendation, "id" | "order"> & { id?: string }>(emptyRec);
  const [recToDelete, setRecToDelete] = useState<Recommendation | null>(null);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "recommendations"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recommendation));
      setRecommendations(recsData);
    }, (error) => {
      const permissionError = new FirestorePermissionError({
        path: "recommendations",
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
    });
    return () => unsubscribe();
  }, [firestore]);

  const handleOpenForm = (rec?: Recommendation) => {
    if (rec) {
      setSelectedRec(rec);
      setIsEditing(true);
    } else {
      setSelectedRec(emptyRec);
      setIsEditing(false);
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedRec(emptyRec);
  };

  const handleFileSelect = (files: SelectedFile[]) => {
    if (files.length > 0) {
        setSelectedRec(prev => ({ ...prev, imageUrl: files[0].url }));
    }
    setIsFileExplorerOpen(false);
  };

  const handleSave = async () => {
    if (!firestore) return;
    const { title, creator, type } = selectedRec;
    if (!title || !creator || !type) {
      toast({ title: "Mangler informasjon", description: "Tittel, opphavsperson og type må fylles ut.", variant: "destructive" });
      return;
    }

    if (isEditing && selectedRec.id) {
      const docRef = doc(firestore, "recommendations", selectedRec.id);
      const { id, ...dataToUpdate } = selectedRec;
      await updateDoc(docRef, dataToUpdate)
        .then(() => toast({ title: "Anbefaling oppdatert!" }))
        .catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: dataToUpdate })));
    } else {
      const newOrder = recommendations.length > 0 ? Math.max(...recommendations.map(r => r.order)) + 1 : 0;
      const dataToAdd = { ...selectedRec, order: newOrder };
      const collRef = collection(firestore, "recommendations");
      await addDoc(collRef, dataToAdd)
        .then(() => toast({ title: "Anbefaling lagt til!" }))
        .catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: collRef.path, operation: 'create', requestResourceData: dataToAdd })));
    }
    handleCloseForm();
  };

  const handleDelete = async () => {
    if (!firestore || !recToDelete) return;
    const docRef = doc(firestore, "recommendations", recToDelete.id);
    await deleteDoc(docRef)
      .then(() => toast({ title: "Anbefaling slettet." }))
      .catch(err => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' })));
    setRecToDelete(null);
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const newRecs = [...recommendations];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newRecs.length) return;

    [newRecs[index], newRecs[targetIndex]] = [newRecs[targetIndex], newRecs[index]];
    
    if (!firestore) return;
    const batch = writeBatch(firestore);
    newRecs.forEach((rec, idx) => {
        const docRef = doc(firestore, "recommendations", rec.id);
        batch.update(docRef, { order: idx });
    });

    await batch.commit().catch(err => toast({title: "Feil ved lagring av rekkefølge", variant: "destructive"}));
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle>Anbefalinger</CardTitle>
            <CardDescription>Administrer anbefalte bøker, videoer og podcaster.</CardDescription>
          </div>
          <Button onClick={() => handleOpenForm()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Ny Anbefaling
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {recommendations.map((rec, index) => (
            <Card key={rec.id} className="flex flex-col md:flex-row items-start p-4 gap-4">
              <div className={cn(
                  "relative w-full md:w-[150px] flex-shrink-0 rounded-md overflow-hidden",
                  rec.type === 'book' ? 'aspect-[2/3]' : rec.type === 'podcast' ? 'aspect-square' : 'aspect-video'
              )}>
                  <Image src={rec.imageUrl || 'https://placehold.co/150x225'} alt={rec.title} fill className="object-cover" unoptimized />
              </div>
              <div className="flex-grow w-full min-w-0">
                <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                        <CardTitle className="text-lg break-words">{rec.title}</CardTitle>
                        <CardDescription className="break-words">{rec.creator}</CardDescription>
                    </div>
                    {/* Desktop buttons */}
                    <div className="hidden md:flex items-center flex-shrink-0">
                        <div className="flex flex-col">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(index, 'up')} disabled={index === 0}><ArrowUp className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(index, 'down')} disabled={index === recommendations.length - 1}><ArrowDown className="h-4 w-4"/></Button>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenForm(rec)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setRecToDelete(rec)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                    {/* Mobile dropdown */}
                    <div className="md:hidden">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenForm(rec)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    <span>Rediger</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleMove(index, "up")} disabled={index === 0}>
                                    <ArrowUp className="mr-2 h-4 w-4" />
                                    <span>Flytt opp</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleMove(index, "down")} disabled={index === recommendations.length - 1}>
                                    <ArrowDown className="mr-2 h-4 w-4" />
                                    <span>Flytt ned</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setRecToDelete(rec)} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Slett</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2 break-words">{rec.description}</p>
                 {rec.linkUrl && <a href={rec.linkUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 mt-2 break-all"><LinkIcon className="h-3 w-3" />{rec.linkUrl}</a>}
              </div>
            </Card>
          ))}
          {recommendations.length === 0 && <p className="text-center text-muted-foreground py-8">Ingen anbefalinger er lagt til enda.</p>}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Rediger' : 'Ny'} Anbefaling</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] -mx-6 px-6">
            <div className="space-y-4 py-4 pr-2">
              <div className="space-y-2">
                <Label>Bilde</Label>
                <div className="flex items-center gap-4">
                  <Image src={selectedRec.imageUrl || 'https://placehold.co/200x150'} alt="Forhåndsvisning" width={200} height={150} className="rounded-md object-cover aspect-video border" unoptimized />
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" onClick={() => setIsFileExplorerOpen(true)}>
                      <FolderOpen className="mr-2 h-4 w-4" /> Velg bilde
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => setSelectedRec(p => ({...p, imageUrl: ''}))}>
                        <Trash2 className="mr-2 h-4 w-4"/> Fjern bilde
                    </Button>
                  </div>
                </div>
              </div>
               <div className="space-y-2">
                  <Label htmlFor="imageUrl">eller lim inn bilde-URL</Label>
                  <Input 
                      id="imageUrl" 
                      value={selectedRec.imageUrl || ''} 
                      onChange={(e) => setSelectedRec(p => ({...p, imageUrl: e.target.value}))} 
                      placeholder="https://..."
                  />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Tittel</Label>
                <Input id="title" value={selectedRec.title} onChange={e => setSelectedRec(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creator">Opphavsperson (Forfatter, regissør, etc.)</Label>
                <Input id="creator" value={selectedRec.creator} onChange={e => setSelectedRec(p => ({ ...p, creator: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Beskrivelse</Label>
                <Textarea id="description" value={selectedRec.description} onChange={e => setSelectedRec(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkUrl">Lenke (valgfritt)</Label>
                <Input id="linkUrl" value={selectedRec.linkUrl || ''} onChange={e => setSelectedRec(p => ({ ...p, linkUrl: e.target.value }))} placeholder="https://youtube.com/... eller https://ark.no/..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={selectedRec.type} onValueChange={(v: RecommendationType) => setSelectedRec(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {recommendationTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="aiHint">AI Bildehint</Label>
                <Input id="aiHint" value={selectedRec.aiHint} onChange={e => setSelectedRec(p => ({ ...p, aiHint: e.target.value }))} placeholder="E.g. 'book cover' or 'art gallery'"/>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseForm}>Avbryt</Button>
            <Button onClick={handleSave}>Lagre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!recToDelete} onOpenChange={() => setRecToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                <AlertDialogDescription>
                    Du er i ferd med å slette anbefalingen "{recToDelete?.title}". Handlingen kan ikke angres.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Ja, slett</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isFileExplorerOpen} onOpenChange={setIsFileExplorerOpen}>
        <DialogContent className="sm:max-w-7xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0"><DialogTitle>Velg et bilde</DialogTitle></DialogHeader>
          <div className="flex-grow min-h-0"><FileExplorer onFileSelect={handleFileSelect} isDialog={true} /></div>
        </DialogContent>
      </Dialog>
    </>
  );
}

    
