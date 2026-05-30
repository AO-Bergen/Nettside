

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Trash2, Eye, Mail, Lightbulb, EyeOff, ArchiveRestore, Undo2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFirestore } from "@/firebase/index";
import { collection, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, Timestamp, writeBatch, getDocs, where } from "firebase/firestore";
import { format } from "date-fns";
import { nb } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


type Message = {
  id: string;
  type: 'Melding' | 'Tips';
  name: string;
  email: string;
  phone?: string;
  message: string;
  projectName?: string;
  createdAt: Timestamp;
  isRead: boolean;
  status: 'inbox' | 'trashed';
};

export default function InboxPage() {
  const firestore = useFirestore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [currentTab, setCurrentTab] = useState("inbox");
  const { toast } = useToast();

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "messages"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(messagesData);
    }, (error) => {
      const permissionError = new FirestorePermissionError({
        path: collection(firestore, "messages").path,
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
    });
    return () => unsubscribe();
  }, [firestore]);

  const handleViewMessage = (message: Message) => {
    setSelectedMessage(message);
    setIsViewDialogOpen(true);
    if (!message.isRead && firestore) {
      const messageDoc = doc(firestore, "messages", message.id);
      updateDoc(messageDoc, { isRead: true }).catch(error => {
        console.error("Error marking message as read:", error);
      });
    }
  };
  
  const handleMarkAsUnread = async (messageId: string) => {
    if (!firestore) return;
    const messageDoc = doc(firestore, "messages", messageId);
    try {
        await updateDoc(messageDoc, { isRead: false });
        toast({ title: "Melding markert som ulest." });
    } catch (error) {
        toast({ title: "Noe gikk galt", variant: "destructive" });
    }
  };

  const openDeleteDialog = (message: Message) => {
    setSelectedMessage(message);
    setIsDeleteDialogOpen(true);
  };
  
  const handleTrashMessage = async (messageId: string) => {
      if (!firestore) return;
      const messageDoc = doc(firestore, "messages", messageId);
      try {
        await updateDoc(messageDoc, { status: 'trashed' });
        toast({ title: "Melding flyttet til søppelkasse." });
      } catch(error) {
         toast({ title: "Noe gikk galt", variant: "destructive" });
      }
  }

   const handleRestoreMessage = async (messageId: string) => {
      if (!firestore) return;
      const messageDoc = doc(firestore, "messages", messageId);
      try {
        await updateDoc(messageDoc, { status: 'inbox' });
        toast({ title: "Meldingen er gjenopprettet." });
      } catch(error) {
         toast({ title: "Noe gikk galt", variant: "destructive" });
      }
  }

  const handlePermanentDelete = async () => {
    if (!selectedMessage || !firestore) return;
    const messageDoc = doc(firestore, "messages", selectedMessage.id);
    try {
      await deleteDoc(messageDoc);
      toast({ title: "Meldingen er slettet." });
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: messageDoc.path,
            operation: 'delete'
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsDeleteDialogOpen(false);
        setSelectedMessage(null);
    }
  };

  const handleEmptyTrash = async () => {
    if (!firestore) return;
    const trashQuery = query(collection(firestore, "messages"), where("status", "==", "trashed"));
    try {
        const snapshot = await getDocs(trashQuery);
        if (snapshot.empty) {
            toast({ title: "Søppelkassen er allerede tom." });
            return;
        }
        const batch = writeBatch(firestore);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast({ title: "Søppelkassen er tømt." });
    } catch (error) {
        toast({ title: "Noe gikk galt", description: "Kunne ikke tømme søppelkassen.", variant: "destructive" });
    } finally {
        setIsDeleteAllDialogOpen(false);
    }
  }

  const inboxMessages = messages.filter(m => m.status !== 'trashed');
  const trashedMessages = messages.filter(m => m.status === 'trashed');
  const messagesToShow = currentTab === 'inbox' ? inboxMessages : trashedMessages;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Innboks</CardTitle>
          <CardDescription>Meldinger og tips sendt inn via nettsiden.</CardDescription>
        </CardHeader>
        <CardContent>
            <Tabs value={currentTab} onValueChange={setCurrentTab}>
                <div className="flex justify-between items-center mb-4">
                    <TabsList>
                        <TabsTrigger value="inbox">Innboks ({inboxMessages.length})</TabsTrigger>
                        <TabsTrigger value="trashed">Søppelkasse ({trashedMessages.length})</TabsTrigger>
                    </TabsList>
                    {currentTab === 'trashed' && trashedMessages.length > 0 && (
                        <Button variant="destructive" size="sm" onClick={() => setIsDeleteAllDialogOpen(true)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Tøm søppelkasse
                        </Button>
                    )}
                </div>
                <TabsContent value="inbox">
                    <MessageList messages={messagesToShow} onTrash={handleTrashMessage} onView={handleViewMessage} onMarkUnread={handleMarkAsUnread} />
                </TabsContent>
                <TabsContent value="trashed">
                    <MessageList messages={messagesToShow} onPermanentDelete={openDeleteDialog} onRestore={handleRestoreMessage} onView={handleViewMessage} />
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
                {selectedMessage?.projectName ? `Tips om: ${selectedMessage.projectName}` : `Melding fra: ${selectedMessage?.name}`}
            </DialogTitle>
            <DialogDescription>
              Mottatt {selectedMessage?.createdAt ? format(selectedMessage.createdAt.toDate(), 'dd. MMMM yyyy, HH:mm', { locale: nb }) : ''}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="space-y-6 pr-2 py-4">
              <div>
                <h3 className="font-semibold mb-2">Avsender</h3>
                <p className="text-sm"><strong>Navn:</strong> {selectedMessage?.name}</p>
                <p className="text-sm"><strong>E-post:</strong> {selectedMessage?.email}</p>
                {selectedMessage?.phone && selectedMessage.phone !== 'Ikke oppgitt' && (
                    <p className="text-sm"><strong>Telefon:</strong> {selectedMessage.phone}</p>
                )}
                {selectedMessage?.email && selectedMessage.email !== 'Ikke oppgitt' && (
                    <Button variant="outline" size="sm" asChild className="mt-2">
                        <a href={`mailto:${selectedMessage.email}`}><Mail className="mr-2 h-4 w-4" />Svar på e-post</a>
                    </Button>
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-2">{selectedMessage?.type === 'Tips' ? 'Tips' : 'Melding'}</h3>
                <p className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-md">{selectedMessage?.message}</p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            {selectedMessage?.isRead && (
                <Button variant="secondary" onClick={() => {
                    if (selectedMessage) {
                        handleMarkAsUnread(selectedMessage.id)
                    }
                    setIsViewDialogOpen(false)
                }}>
                    <EyeOff className="mr-2 h-4 w-4" /> Marker som ulest
                </Button>
            )}
            <Button onClick={() => setIsViewDialogOpen(false)}>Lukk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                <AlertDialogDescription>
                    Du er i ferd med å slette meldingen fra "{selectedMessage?.name}" permanent. Handlingen kan ikke angres.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={handlePermanentDelete}>Ja, slett permanent</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Tømme søppelkassen?</AlertDialogTitle>
                <AlertDialogDescription>
                    Er du sikker på at du vil slette alle {trashedMessages.length} meldingene i søppelkassen permanent? Handlingen kan ikke angres.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={handleEmptyTrash}>Ja, tøm søppelkassen</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface MessageListProps {
    messages: Message[];
    onView: (message: Message) => void;
    onTrash?: (id: string) => void;
    onRestore?: (id: string) => void;
    onPermanentDelete?: (message: Message) => void;
    onMarkUnread?: (id: string) => void;
}

function MessageList({ messages, onView, onTrash, onRestore, onPermanentDelete, onMarkUnread }: MessageListProps) {
    if (messages.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground border rounded-lg border-dashed">
                <p>Ingen meldinger her.</p>
            </div>
        );
    }
    
    const isTrash = !!onRestore;

    return (
        <div className="border rounded-lg">
            {/* Desktop Header */}
            <div className="hidden md:flex items-center px-4 py-2 border-b bg-muted/50 text-sm font-medium text-muted-foreground">
                <div className="w-[100px]">Status</div>
                <div className="w-[120px]">Type</div>
                <div className="flex-1">Innhold</div>
                <div className="w-[200px]">Innsender</div>
                <div className="w-[150px]">Dato</div>
                <div className="w-[60px] text-right"></div>
            </div>
            
            <div>
                {messages.map((message) => (
                <div
                    key={message.id}
                    onClick={() => onView(message)}
                    className={cn(
                    "grid grid-cols-[auto_1fr_auto] md:grid-cols-[100px_120px_1fr_200px_150px_60px] items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0",
                    !message.isRead && "bg-primary/5"
                    )}
                >
                    {/* === MOBILE & DESKTOP - STATUS === */}
                    <div className="hidden md:flex items-center gap-2">
                        {!message.isRead ? <EyeOff className="h-4 w-4 text-primary"/> : <Eye className="h-4 w-4 text-muted-foreground"/>}
                        <Badge variant={!message.isRead ? "default" : "secondary"}>
                            {!message.isRead ? "Ny" : "Lest"}
                        </Badge>
                    </div>
                    <div className="md:hidden flex justify-center">
                            {!message.isRead ? <EyeOff className="h-5 w-5 text-primary"/> : <Eye className="h-5 w-5 text-muted-foreground"/>}
                    </div>

                    {/* === MOBILE VIEW - CONTENT === */}
                    <div className="md:hidden min-w-0 -ml-2">
                        <div className="flex justify-between items-baseline">
                            <p className={cn("font-semibold", !message.isRead && "text-foreground")}>
                                {message.name}
                            </p>
                            <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                            {message.createdAt ? format(message.createdAt.toDate(), 'd MMM', { locale: nb }) : ''}
                            </p>
                        </div>
                        <p className={cn("font-bold", !message.isRead && "text-foreground")}>
                            {message.projectName}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                            {message.message}
                        </p>
                    </div>

                    {/* === DESKTOP VIEW - CONTENT === */}
                    <div className="hidden md:block">
                    <Badge variant={message.type === "Tips" ? "outline" : "secondary"}>
                        <div className="flex items-center gap-1">
                        {message.type === 'Tips' ? <Lightbulb className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                        {message.type}
                        </div>
                    </Badge>
                    </div>
                    <div className="hidden md:flex flex-col overflow-hidden">
                    <p className={cn("truncate", !message.isRead && "font-bold text-foreground")}>
                        {message.projectName}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                        {message.message}
                    </p>
                    </div>
                    <div className="hidden md:block truncate">{message.name}</div>
                    <div className="hidden md:block text-sm text-muted-foreground">
                    {message.createdAt ? format(message.createdAt.toDate(), 'dd. MMM yyyy, HH:mm', { locale: nb }) : ''}
                    </div>
                    
                    {/* === MOBILE & DESKTOP - ACTIONS === */}
                    <div className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Meny</span>
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuLabel>Handlinger</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => onView(message)}>
                            <Eye className="mr-2 h-4 w-4" /> Les melding
                        </DropdownMenuItem>
                        {isTrash ? (
                            <>
                                {onRestore && <DropdownMenuItem onSelect={() => onRestore(message.id)}><Undo2 className="mr-2 h-4 w-4" />Gjenopprett</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                {onPermanentDelete && <DropdownMenuItem onSelect={() => onPermanentDelete(message)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Slett permanent</DropdownMenuItem>}
                            </>
                        ) : (
                            <>
                                {onMarkUnread && message.isRead && <DropdownMenuItem onSelect={() => onMarkUnread(message.id)}><EyeOff className="mr-2 h-4 w-4" />Marker som ulest</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                {onTrash && <DropdownMenuItem onSelect={() => onTrash(message.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Flytt til søppelkasse</DropdownMenuItem>}
                            </>
                        )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                </div>
                ))}
            </div>
        </div>
    );
}
