

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, FolderOpen, Trash2, UserPlus, X, Facebook, Edit, MoreHorizontal, MessageSquarePlus, ArrowUp, ArrowDown, MapPin, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useStorage } from "@/firebase/index";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, Timestamp, QueryDocumentSnapshot, DocumentData, getDoc } from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { FileExplorer, type SelectedFile } from "@/components/site/file-explorer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { MarkdownEditor } from "@/components/site/markdown-editor";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventPosterGenerator } from "@/components/dashboard/event-poster-generator";

const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
};

export type Participant = {
  id: string;
  name: string;
  role: string;
  imageUrl: string;
}

export type EventFromFirestore = {
  id: string;
  title: string;
  slug: string;
  description: string;
  location: string;
  eventDate: Timestamp; 
  eventTime: string; 
  isPaid: boolean;
  ticketUrl: string;
  imageUrl?: string;
  imageFocalPoint?: { x: number; y: number; };
  participants: Omit<Participant, 'id'>[];
  facebookEventUrl?: string;
  updates?: string[];
};

type EventForForm = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  location: string;
  eventDate: string;
  eventTime: string; 
  isPaid: boolean;
  ticketUrl: string;
  imageUrl?: string;
  imageFocalPoint?: { x: number; y: number; };
  participants: Participant[];
  facebookEventUrl?: string;
  updates: string[];
};

const emptyEvent: EventForForm = { 
  title: '', 
  slug: '',
  description: '', 
  location: '', 
  eventDate: '', 
  eventTime: '',
  isPaid: false,
  ticketUrl: '',
  imageUrl: '',
  imageFocalPoint: { x: 50, y: 50 },
  participants: [],
  facebookEventUrl: '',
  updates: []
};

const convertToEventForForm = (event: EventFromFirestore): EventForForm => {
    return {
        ...event,
        eventDate: format(event.eventDate.toDate(), 'yyyy-MM-dd'),
        isPaid: event.isPaid ?? false,
        ticketUrl: event.ticketUrl ?? '',
        imageUrl: event.imageUrl ?? '',
        imageFocalPoint: event.imageFocalPoint ?? { x: 50, y: 50 },
        participants: event.participants?.map(p => ({...p, id: Math.random().toString()})) || [],
        facebookEventUrl: event.facebookEventUrl ?? '',
        updates: event.updates ?? []
    };
};


export default function EventsPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const [events, setEvents] = useState<EventFromFirestore[]>([]);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isUpdatesDialogOpen, setIsUpdatesDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  const [selectedEvent, setSelectedEvent] = useState<EventForForm>(emptyEvent);
  const [eventToDelete, setEventToDelete] = useState<EventFromFirestore | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [imageTarget, setImageTarget] = useState<{type: 'main' | 'participant', index?: number} | null>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "events"), orderBy("eventDate", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const eventsData: EventFromFirestore[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        eventsData.push({ id: doc.id, ...doc.data() } as EventFromFirestore);
      });
      setEvents(eventsData);

      const editId = searchParams.get('edit');
      if (editId) {
          const eventToEdit = eventsData.find(e => e.id === editId);
          if (eventToEdit) {
              handleOpenEditDialog(eventToEdit);
          }
      }
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: collection(firestore, "events").path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    return () => unsubscribe();
  }, [firestore, searchParams]);
  
  const handleOpenEditDialog = useCallback((event?: EventFromFirestore) => {
    if (event) {
      setSelectedEvent(convertToEventForForm(event));
      setIsEditing(true);
    } else {
      setSelectedEvent(emptyEvent);
      setIsEditing(false);
    }
    setIsFormDialogOpen(true);
  }, []);
  
  const handleOpenUpdatesDialog = useCallback((event: EventFromFirestore) => {
    setSelectedEvent(convertToEventForForm(event));
    setIsUpdatesDialogOpen(true);
  }, []);

  const handleOpenDeleteDialog = useCallback((event: EventFromFirestore) => {
      setEventToDelete(event);
      setIsDeleteConfirmOpen(true);
  }, []);

  const handleCloseDialogs = () => {
    setIsFormDialogOpen(false);
    setIsUpdatesDialogOpen(false);
    setIsDeleteConfirmOpen(false);
    setSelectedEvent(emptyEvent);
    setEventToDelete(null);
    setIsEditing(false);
  }
  
  const handleDescriptionChange = useCallback((content: string) => {
      setSelectedEvent(prev => ({...prev, description: content}));
  }, []);

  const handleFileSelect = (files: SelectedFile[]) => {
    if (!imageTarget || files.length === 0) {
        setIsFileExplorerOpen(false);
        return;
    };
    const url = files[0].url;

    if (imageTarget.type === 'main') {
        setSelectedEvent(prev => ({...prev, imageUrl: url}));
    } else if (imageTarget.type === 'participant' && imageTarget.index !== undefined) {
        const newParticipants = [...selectedEvent.participants];
        newParticipants[imageTarget.index].imageUrl = url;
        setSelectedEvent(prev => ({...prev, participants: newParticipants}));
    }
    setIsFileExplorerOpen(false);
  }
  
  const handleAddParticipant = () => {
      setSelectedEvent(prev => ({
          ...prev,
          participants: [...prev.participants, { id: Math.random().toString(), name: '', role: '', imageUrl: ''}]
      }))
  }

  const handleRemoveParticipant = (id: string) => {
    setSelectedEvent(prev => ({
        ...prev,
        participants: prev.participants.filter(p => p.id !== id)
    }))
  }

  const handleParticipantChange = (index: number, field: 'name' | 'role', value: string) => {
      const newParticipants = [...selectedEvent.participants];
      newParticipants[index][field] = value;
      setSelectedEvent(prev => ({...prev, participants: newParticipants}));
  }

  const handleAddUpdate = () => {
    setSelectedEvent(prev => ({ ...prev, updates: [...prev.updates, ''] }));
  };

  const handleUpdateChange = (index: number, value: string) => {
    const newUpdates = [...selectedEvent.updates];
    newUpdates[index] = value;
    setSelectedEvent(prev => ({ ...prev, updates: newUpdates }));
  };

  const handleRemoveUpdate = (index: number) => {
    setSelectedEvent(prev => ({ ...prev, updates: prev.updates.filter((_, i) => i !== index) }));
  };

  const handleMoveUpdate = (index: number, direction: 'up' | 'down') => {
    const newUpdates = [...selectedEvent.updates];
    if (direction === 'up' && index > 0) {
        [newUpdates[index - 1], newUpdates[index]] = [newUpdates[index], newUpdates[index - 1]];
        setSelectedEvent(prev => ({ ...prev, updates: newUpdates }));
    } else if (direction === 'down' && index < newUpdates.length - 1) {
        [newUpdates[index + 1], newUpdates[index]] = [newUpdates[index], newUpdates[index + 1]];
        setSelectedEvent(prev => ({ ...prev, updates: newUpdates }));
    }
  }

  const handleSaveEvent = async () => {
    if (!firestore) return;
    if (!selectedEvent.title || !selectedEvent.eventDate || !selectedEvent.location) {
        toast({
            title: "Mangler informasjon",
            description: "Tittel, dato og sted må fylles ut.",
            variant: "destructive",
        });
        return;
    }
    
    const date = parseISO(selectedEvent.eventDate);
    if (isNaN(date.getTime())) {
        toast({
            title: "Ugyldig dato",
            description: "Vennligst velg en gyldig dato.",
            variant: "destructive",
        });
        return;
    }
    
    date.setUTCHours(12, 0, 0, 0);

    const eventDataToSave = {
        title: selectedEvent.title,
        slug: selectedEvent.slug || slugify(selectedEvent.title),
        description: selectedEvent.description || '',
        location: selectedEvent.location,
        eventDate: Timestamp.fromDate(date),
        eventTime: selectedEvent.eventTime || '',
        isPaid: selectedEvent.isPaid || false,
        ticketUrl: selectedEvent.isPaid ? (selectedEvent.ticketUrl || '') : '',
        imageUrl: selectedEvent.imageUrl || '',
        imageFocalPoint: selectedEvent.imageFocalPoint ?? { x: 50, y: 50 },
        participants: selectedEvent.participants.map(({id, ...rest}) => rest),
        facebookEventUrl: selectedEvent.facebookEventUrl || '',
        updates: selectedEvent.updates.filter(u => u.trim() !== '') || [],
    };

    if (isEditing && selectedEvent.id) {
        const eventDoc = doc(firestore, "events", selectedEvent.id);
        updateDoc(eventDoc, eventDataToSave).then(() => {
            toast({ title: "Arrangement oppdatert!" });
            handleCloseDialogs();
        }).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: eventDoc.path,
                operation: 'update',
                requestResourceData: eventDataToSave
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    } else {
        const eventsCollection = collection(firestore, "events");
        addDoc(eventsCollection, eventDataToSave).then(() => {
            toast({ title: "Arrangement opprettet!" });
            handleCloseDialogs();
        }).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: eventsCollection.path,
                operation: 'create',
                requestResourceData: eventDataToSave
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }
  };

  const handleSaveUpdates = async () => {
    if (!selectedEvent.id || !firestore) return;
    const eventDoc = doc(firestore, "events", selectedEvent.id);
    const updatesToSave = selectedEvent.updates.filter(u => u.trim() !== '');

    updateDoc(eventDoc, { updates: updatesToSave }).then(() => {
        toast({ title: "Oppdateringer lagret!" });
        handleCloseDialogs();
    }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: eventDoc.path,
            operation: 'update',
            requestResourceData: { updates: updatesToSave }
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  }

  const handleDeleteEvent = useCallback(async () => {
        if (!eventToDelete || !firestore || !storage) return;

        const eventDoc = doc(firestore, "events", eventToDelete.id);
        deleteDoc(eventDoc).then(() => {
             toast({ title: "Arrangement slettet." });
             if (eventToDelete.imageUrl) {
                const imageRef = storageRef(storage, eventToDelete.imageUrl);
                deleteObject(imageRef).catch(storageError => {
                     if (storageError.code !== 'storage/object-not-found') {
                        console.warn("Could not delete image from storage:", storageError);
                    }
                });
            }
        }).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: eventDoc.path,
                operation: 'delete'
            });
            errorEmitter.emit('permission-error', permissionError);
        }).finally(() => {
            handleCloseDialogs();
        });
  }, [toast, eventToDelete, firestore, storage]);

  return (
    <>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="overview">Arrangementer</TabsTrigger>
            <TabsTrigger value="generator">Plakatgenerator</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <CardTitle>Arrangementer</CardTitle>
                    <CardDescription>Administrer kommende og tidligere arrangementer.</CardDescription>
                </div>
                <Button size="sm" className="gap-1 w-full md:w-auto" onClick={() => handleOpenEditDialog()}>
                    <PlusCircle className="h-4 w-4" />
                    Nytt Arrangement
                </Button>
                </CardHeader>
                <CardContent>
                    {/* Mobile View */}
                    <div className="md:hidden space-y-4">
                        {events.map((event) => (
                            <Card key={event.id} className="flex gap-4 p-4">
                                {event.imageUrl ? (
                                    <Image src={event.imageUrl} alt={event.title} width={80} height={80} className="rounded-md object-cover aspect-square" unoptimized />
                                ) : (
                                    <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center text-muted-foreground text-xs text-center">No Image</div>
                                )}
                                <div className="flex-grow min-w-0">
                                    <h3 className="font-semibold">{event.title}</h3>
                                    <p className="text-sm text-muted-foreground">{format(event.eventDate.toDate(), 'dd. MMMM yyyy')}</p>
                                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1"><MapPin className="h-3 w-3"/>{event.location}</p>
                                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1"><Clock className="h-3 w-3"/>{event.eventTime}</p>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Meny</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Handlinger</DropdownMenuLabel>
                                        <DropdownMenuItem onSelect={() => handleOpenEditDialog(event)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Rediger
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleOpenUpdatesDialog(event)}>
                                            <MessageSquarePlus className="mr-2 h-4 w-4" />
                                            Oppdateringer
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={() => handleOpenDeleteDialog(event)} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Slett
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
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
                                <TableHead>Dato</TableHead>
                                <TableHead>Tid</TableHead>
                                <TableHead>Sted</TableHead>
                                <TableHead className="text-right w-[100px]">Handlinger</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {events.map((event) => (
                                <TableRow key={event.id}>
                                    <TableCell>
                                        {event.imageUrl ? (
                                            <Image src={event.imageUrl} alt={event.title} width={64} height={64} className="rounded-md object-cover aspect-square" unoptimized />
                                        ) : (
                                            <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center text-muted-foreground text-xs text-center">No Image</div>
                                        )}
                                    </TableCell>
                                <TableCell className="font-medium">
                                    {event.title}
                                </TableCell>
                                <TableCell>{format(event.eventDate.toDate(), 'dd. MMMM yyyy')}</TableCell>
                                <TableCell>{event.eventTime}</TableCell>
                                <TableCell>{event.location}</TableCell>
                                <TableCell className="text-right">
                                <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Meny</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Handlinger</DropdownMenuLabel>
                                            <DropdownMenuItem onSelect={() => handleOpenEditDialog(event)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Rediger
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleOpenUpdatesDialog(event)}>
                                                <MessageSquarePlus className="mr-2 h-4 w-4" />
                                                Oppdateringer
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onSelect={() => handleOpenDeleteDialog(event)} className="text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Slett
                                            </DropdownMenuItem>
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
        </TabsContent>
        <TabsContent value="generator">
            <EventPosterGenerator events={events} />
        </TabsContent>
      </Tabs>
      
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogContent className="sm:max-w-4xl">
              <DialogHeader>
                  <DialogTitle>{isEditing ? 'Rediger arrangement' : 'Nytt arrangement'}</DialogTitle>
                  <DialogDescription>
                      {isEditing ? `Endre detaljene for arrangementet.` : `Fyll ut detaljene for det nye arrangementet.`}
                  </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                  <div className="grid gap-6 py-4 pr-2">
                      <div className="space-y-2">
                          <Label htmlFor="title">Tittel</Label>
                          <Input 
                              id="title" 
                              value={selectedEvent.title} 
                              onChange={(e) => setSelectedEvent({ ...selectedEvent, title: e.target.value, slug: slugify(e.target.value) })} />
                      </div>
                       <div className="space-y-4">
                            <Label>Hovedbilde</Label>
                            <div className="flex items-center gap-4">
                                {selectedEvent.imageUrl ? (
                                    <Image src={selectedEvent.imageUrl} alt="Event image" width={100} height={100} className="rounded-md border aspect-square object-cover" unoptimized/>
                                ) : (
                                    <div className="w-[100px] h-[100px] bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground">Ingen bilde</div>
                                )}
                                <div className="flex flex-col gap-2">
                                    <Button variant="outline" onClick={() => {setIsFileExplorerOpen(true); setImageTarget({type: 'main'})}}>
                                        <FolderOpen className="mr-2 h-4 w-4" />
                                        Velg bilde
                                    </Button>
                                    {selectedEvent.imageUrl && (
                                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setSelectedEvent({...selectedEvent, imageUrl: ''})}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Fjern bilde
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {selectedEvent.imageUrl && (
                                <div className="space-y-4 pt-4">
                                    <Label>Bildets fokuspunkt</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Forhåndsvisning (Landskap)</Label>
                                            <div className='relative aspect-video w-full overflow-hidden rounded-md border'>
                                                <Image
                                                    src={selectedEvent.imageUrl}
                                                    alt="Focal point preview landscape"
                                                    fill
                                                    className="object-cover"
                                                    style={{ objectPosition: `${selectedEvent.imageFocalPoint?.x ?? 50}% ${selectedEvent.imageFocalPoint?.y ?? 50}%` }}
                                                    unoptimized
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs text-muted-foreground">Forhåndsvisning (Portrett)</Label>
                                            <div className='relative aspect-[9/16] w-full max-w-[150px] mx-auto overflow-hidden rounded-md border'>
                                                <Image
                                                    src={selectedEvent.imageUrl}
                                                    alt="Focal point preview portrait"
                                                    fill
                                                    className="object-cover"
                                                    style={{ objectPosition: `${selectedEvent.imageFocalPoint?.x ?? 50}% ${selectedEvent.imageFocalPoint?.y ?? 50}%` }}
                                                    unoptimized
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="focal-x" className="text-sm">Horisontal (X: {selectedEvent.imageFocalPoint?.x ?? 50}%)</Label>
                                            <Slider
                                                id="focal-x"
                                                min={0}
                                                max={100}
                                                step={1}
                                                value={[selectedEvent.imageFocalPoint?.x ?? 50]}
                                                onValueChange={([val]) => setSelectedEvent(prev => ({...prev, imageFocalPoint: { ...(prev.imageFocalPoint ?? {x:50, y:50}), x: val } }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="focal-y" className="text-sm">Vertikal (Y: {selectedEvent.imageFocalPoint?.y ?? 50}%)</Label>
                                                <Slider
                                                id="focal-y"
                                                min={0}
                                                max={100}
                                                step={1}
                                                value={[selectedEvent.imageFocalPoint?.y ?? 50]}
                                                onValueChange={([val]) => setSelectedEvent(prev => ({...prev, imageFocalPoint: { ...(prev.imageFocalPoint ?? {x:50, y:50}), y: val } }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label htmlFor="date">Dato</Label>
                              <Input id="date" type="date" value={selectedEvent.eventDate} onChange={(e) => setSelectedEvent({ ...selectedEvent, eventDate: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="time">Klokkeslett</Label>
                              <Input id="time" type="time" value={selectedEvent.eventTime} onChange={(e) => setSelectedEvent({ ...selectedEvent, eventTime: e.target.value })} />
                          </div>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="location">Sted</Label>
                          <Input id="location" value={selectedEvent.location} onChange={(e) => setSelectedEvent({ ...selectedEvent, location: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="description">Beskrivelse</Label>
                          <div className="h-[300px] border rounded-md">
                            <MarkdownEditor
                                initialContent={selectedEvent.description}
                                onContentChange={handleDescriptionChange}
                            />
                          </div>
                      </div>
                      <div className="space-y-4 pt-4 border-t">
                          <h3 className="font-medium text-lg">Deltakere</h3>
                              <div className="space-y-4">
                              {selectedEvent.participants.map((p, index) => (
                                  <div key={p.id} className="p-4 border rounded-lg relative space-y-4">
                                          <Button
                                          variant="ghost"
                                          size="icon"
                                          className="absolute top-2 right-2 h-6 w-6"
                                          onClick={() => handleRemoveParticipant(p.id)}
                                      >
                                          <X className="h-4 w-4" />
                                      </Button>
                                      <div className="flex items-center gap-4">
                                          <Avatar className="w-16 h-16">
                                              {p.imageUrl && <AvatarImage src={p.imageUrl} className="object-cover"/>}
                                              <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                          </Avatar>
                                          <Button variant="outline" size="sm" onClick={() => {setIsFileExplorerOpen(true); setImageTarget({type: 'participant', index})}}>
                                              Velg bilde
                                          </Button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                          <div className="space-y-2">
                                              <Label>Navn</Label>
                                              <Input value={p.name} onChange={(e) => handleParticipantChange(index, 'name', e.target.value)}/>
                                          </div>
                                              <div className="space-y-2">
                                              <Label>Rolle</Label>
                                              <Input value={p.role} onChange={(e) => handleParticipantChange(index, 'role', e.target.value)}/>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                              </div>
                          <Button variant="outline" onClick={handleAddParticipant}>
                              <UserPlus className="mr-2 h-4 w-4"/>
                              Legg til deltaker
                          </Button>
                      </div>
                      <div className="space-y-4 pt-4 border-t">
                          <div className="flex items-center space-x-2">
                              <Switch 
                              id="isPaid" 
                              checked={selectedEvent.isPaid} 
                              onCheckedChange={(checked) => setSelectedEvent({...selectedEvent, isPaid: checked})}
                              />
                              <Label htmlFor="isPaid">Betalt arrangement</Label>
                          </div>
                          {selectedEvent.isPaid && (
                              <div className="space-y-2">
                                  <Label htmlFor="ticketUrl">Lenke til billetter</Label>
                                  <Input 
                                      id="ticketUrl" 
                                      placeholder="https://tikkio.com/..."
                                      value={selectedEvent.ticketUrl} 
                                      onChange={(e) => setSelectedEvent({ ...selectedEvent, ticketUrl: e.target.value })} />
                              </div>
                          )}
                          <div className="space-y-2">
                              <Label htmlFor="facebookEventUrl">Lenke til Facebook-arrangement</Label>
                              <Input 
                                  id="facebookEventUrl" 
                                  placeholder="https://facebook.com/events/..."
                                  value={selectedEvent.facebookEventUrl} 
                                  onChange={(e) => setSelectedEvent({ ...selectedEvent, facebookEventUrl: e.target.value })} />
                          </div>
                      </div>
                  </div>
              </ScrollArea>
              <DialogFooter>
                  <Button variant="outline" onClick={handleCloseDialogs}>Avbryt</Button>
                  <Button onClick={handleSaveEvent}>Lagre</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <Dialog open={isUpdatesDialogOpen} onOpenChange={setIsUpdatesDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Administrer Oppdateringer</DialogTitle>
                <DialogDescription>
                    Legg til, endre eller fjern oppdateringer for arrangementet "{selectedEvent.title}".
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="space-y-4 py-4 pr-2">
                    {selectedEvent.updates.map((update, index) => (
                        <div key={index} className="flex items-start gap-2">
                             <div className="flex flex-col gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMoveUpdate(index, 'up')} disabled={index === 0}>
                                    <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMoveUpdate(index, 'down')} disabled={index === selectedEvent.updates.length - 1}>
                                    <ArrowDown className="h-4 w-4" />
                                </Button>
                            </div>
                            <Textarea
                                value={update}
                                onChange={(e) => handleUpdateChange(index, e.target.value)}
                                placeholder={`Oppdatering ${index + 1} (støtter Markdown)`}
                                rows={3}
                            />
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveUpdate(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                     <Button variant="outline" onClick={handleAddUpdate}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Legg til oppdatering
                    </Button>
                </div>
            </ScrollArea>
             <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialogs}>Avbryt</Button>
                <Button onClick={handleSaveUpdates}>Lagre Oppdateringer</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

       <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                <AlertDialogDescription>
                    Du er i ferd med å slette arrangementet "{eventToDelete?.title}". Handlingen kan ikke angres.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={handleCloseDialogs}>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteEvent}>Ja, slett</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </>
  );
}
