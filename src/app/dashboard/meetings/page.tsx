

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore } from "@/firebase/index";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, Timestamp, arrayUnion, arrayRemove } from "firebase/firestore";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Calendar as CalendarIcon, PlusCircle, Trash2, Edit, X, MessageSquare, CornerDownRight, Clock, MapPin, ArrowUp, ArrowDown, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";


type AgendaSubItem = {
    id: string;
    text: string;
    addedBy: {
        uid: string;
        name: string;
    }
}

type AgendaItem = {
    id: string;
    text: string;
    addedBy: {
        uid: string;
        name: string;
    };
    subItems: AgendaSubItem[];
};

type Meeting = {
  id: string;
  title: string;
  date: Timestamp;
  time?: string;
  location?: string;
  agenda: AgendaItem[];
};

export default function MeetingsPage() {
  const firestore = useFirestore();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isNewMeetingDialogOpen, setIsNewMeetingDialogOpen] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [newMeetingTime, setNewMeetingTime] = useState("");
  const [newMeetingLocation, setNewMeetingLocation] = useState("");
  const [newAgendaItemInputs, setNewAgendaItemInputs] = useState<{[key: string]: string}>({});
  const [newSubItemInputs, setNewSubItemInputs] = useState<{[key: string]: string}>({});
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "meetings"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const meetingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meeting));
      setMeetings(meetingsData);
    },
    (error) => {
        const permissionError = new FirestorePermissionError({
            path: 'meetings',
            operation: 'list'
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    return () => unsubscribe();
  }, [firestore]);

  const meetingsOnSelectedDate = meetings.filter(
    (meeting) => format(meeting.date.toDate(), "yyyy-MM-dd") === format(selectedDate || new Date(), "yyyy-MM-dd")
  );
  
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Set time to the beginning of the day for accurate comparison
  const upcomingMeetings = meetings.filter(m => m.date.toDate() >= now);
  const pastMeetings = meetings
    .filter(m => m.date.toDate() < now)
    .sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime()); // Sort descending

  const handleAddMeeting = async () => {
    if (!newMeetingTitle || !selectedDate || !firestore) {
      toast({ title: "Mangler informasjon", description: "Tittel og dato må være valgt.", variant: "destructive" });
      return;
    }

    const dataToSave = {
      title: newMeetingTitle,
      date: Timestamp.fromDate(selectedDate),
      time: newMeetingTime,
      location: newMeetingLocation,
      agenda: [],
    };
    const meetingsCollection = collection(firestore, "meetings");

    addDoc(meetingsCollection, dataToSave).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: meetingsCollection.path,
            operation: 'create',
            requestResourceData: dataToSave
        });
        errorEmitter.emit('permission-error', permissionError);
    }).then(() => {
        toast({ title: "Møte opprettet!" });
        setNewMeetingTitle("");
        setNewMeetingTime("");
        setNewMeetingLocation("");
        setIsNewMeetingDialogOpen(false);
    });
  };
  
  const handleDeleteMeeting = async (meetingId: string) => {
    if (!firestore) return;
    const meetingDoc = doc(firestore, "meetings", meetingId);
    deleteDoc(meetingDoc).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: meetingDoc.path,
            operation: 'delete'
        });
        errorEmitter.emit('permission-error', permissionError);
    }).then(() => {
        toast({ title: "Møte slettet" });
    });
  }

  const handleAddAgendaItem = async (meetingId: string) => {
    if (!firestore) return;
    const text = newAgendaItemInputs[meetingId]?.trim();
    if (!text || !user) return;

    const newItem: AgendaItem = {
      id: new Date().toISOString() + Math.random(), // Unique ID
      text,
      addedBy: {
        uid: user.uid,
        name: user.displayName || "Ukjent Bruker",
      },
      subItems: [],
    };
    
    const meetingDoc = doc(firestore, "meetings", meetingId);
    updateDoc(meetingDoc, {
      agenda: arrayUnion(newItem),
    }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: meetingDoc.path,
            operation: 'update',
            requestResourceData: { agenda: arrayUnion(newItem) }
        });
        errorEmitter.emit('permission-error', permissionError);
    }).then(() => {
      setNewAgendaItemInputs(prev => ({...prev, [meetingId]: ''}));
      toast({ title: "Agendapunkt lagt til." });
    });
  };

  const handleRemoveAgendaItem = async (meetingId: string, itemToRemove: AgendaItem) => {
    if (!firestore) return;
    const meetingDoc = doc(firestore, "meetings", meetingId);
    updateDoc(meetingDoc, {
      agenda: arrayRemove(itemToRemove),
    }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: meetingDoc.path,
            operation: 'update',
            requestResourceData: { agenda: arrayRemove(itemToRemove) }
        });
        errorEmitter.emit('permission-error', permissionError);
    }).then(() => {
      toast({ title: "Agendapunkt fjernet." });
    });
  };

  const handleMoveAgendaItem = async (meetingId: string, index: number, direction: 'up' | 'down') => {
    if (!firestore) return;
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting || !meeting.agenda) return;

    const newAgenda = [...meeting.agenda];
    const item = newAgenda[index];

    if (direction === 'up' && index > 0) {
      newAgenda.splice(index, 1);
      newAgenda.splice(index - 1, 0, item);
    } else if (direction === 'down' && index < newAgenda.length - 1) {
      newAgenda.splice(index, 1);
      newAgenda.splice(index + 1, 0, item);
    } else {
      return; // Can't move
    }

    const meetingDoc = doc(firestore, "meetings", meetingId);
    updateDoc(meetingDoc, { agenda: newAgenda }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: meetingDoc.path,
            operation: 'update',
            requestResourceData: { agenda: newAgenda }
        });
        errorEmitter.emit('permission-error', permissionError);
    }).then(() => {
      toast({ title: "Agenda rekkefølge oppdatert." });
    });
  };

  const handleAddSubItem = async (meetingId: string, parentItemId: string) => {
    if (!firestore) return;
    const text = newSubItemInputs[parentItemId]?.trim();
    if (!text || !user) return;

    const selectedMeeting = meetings.find(m => m.id === meetingId);
    if (!selectedMeeting) return;

    const newSubItem: AgendaSubItem = {
      id: new Date().toISOString() + Math.random(),
      text,
      addedBy: {
        uid: user.uid,
        name: user.displayName || "Ukjent Bruker",
      },
    };

    const updatedAgenda = selectedMeeting.agenda.map(item => {
        if (item.id === parentItemId) {
            return {
                ...item,
                subItems: [...(item.subItems || []), newSubItem]
            };
        }
        return item;
    });

    const meetingDoc = doc(firestore, "meetings", meetingId);
    updateDoc(meetingDoc, { agenda: updatedAgenda }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: meetingDoc.path,
            operation: 'update',
            requestResourceData: { agenda: updatedAgenda }
        });
        errorEmitter.emit('permission-error', permissionError);
    }).then(() => {
        setNewSubItemInputs(prev => ({...prev, [parentItemId]: ''}));
        toast({ title: "Underpunkt lagt til" });
    });
  }

   const handleRemoveSubItem = async (meetingId: string, parentItemId: string, subItemToRemove: AgendaSubItem) => {
    if (!firestore) return;
    const selectedMeeting = meetings.find(m => m.id === meetingId);
    if (!selectedMeeting) return;

    const updatedAgenda = selectedMeeting.agenda.map(item => {
        if (item.id === parentItemId) {
            return {
                ...item,
                subItems: item.subItems.filter(si => si.id !== subItemToRemove.id)
            };
        }
        return item;
    });

    const meetingDoc = doc(firestore, "meetings", meetingId);
    updateDoc(meetingDoc, { agenda: updatedAgenda }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: meetingDoc.path,
            operation: 'update',
            requestResourceData: { agenda: updatedAgenda }
        });
        errorEmitter.emit('permission-error', permissionError);
    }).then(() => {
        toast({ title: "Underpunkt fjernet" });
    });
  }


  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Møtekalender</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="p-0"
              locale={nb}
              modifiers={{
                hasMeeting: meetings.map(m => m.date.toDate())
              }}
              modifiersStyles={{
                hasMeeting: {
                    fontWeight: 'bold',
                    textDecoration: 'underline',
                    textDecorationColor: 'hsl(var(--primary))'
                }
              }}
            />
          </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Kommende Møter</CardTitle>
            </CardHeader>
            <CardContent>
                {upcomingMeetings.length > 0 ? (
                    <ul className="space-y-4">
                        {upcomingMeetings.map(meeting => (
                            <li key={meeting.id} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="font-medium">{meeting.title}</p>
                                    <p className="text-muted-foreground">{format(meeting.date.toDate(), "EEEE d. MMMM", { locale: nb })} {meeting.time && `kl. ${meeting.time}`}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(meeting.date.toDate())}>
                                    Vis
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground text-center">Ingen kommende møter planlagt.</p>
                )}
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Tidligere Møter</CardTitle>
            </CardHeader>
            <CardContent>
                {pastMeetings.length > 0 ? (
                    <ul className="space-y-4 max-h-60 overflow-y-auto">
                        {pastMeetings.map(meeting => (
                            <li key={meeting.id} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="font-medium">{meeting.title}</p>
                                    <p className="text-muted-foreground">{format(meeting.date.toDate(), "d. MMMM yyyy", { locale: nb })}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(meeting.date.toDate())}>
                                    Vis
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground text-center">Ingen tidligere møter.</p>
                )}
            </CardContent>
        </Card>
      </div>

      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                Møter for{" "}
                {selectedDate
                  ? format(selectedDate, "d. MMMM yyyy", { locale: nb })
                  : "..."}
              </span>
              <Button size="sm" onClick={() => setIsNewMeetingDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Planlegg møte
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {meetingsOnSelectedDate.length > 0 ? (
              meetingsOnSelectedDate.map((meeting) => (
                <Card key={meeting.id}>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            {meeting.title}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Du er i ferd med å slette møtet "{meeting.title}". Dette kan ikke angres.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteMeeting(meeting.id)}>Ja, slett</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardTitle>
                        <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 pt-2">
                             {meeting.time && (
                                <span className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" /> Kl. {meeting.time}
                                </span>
                            )}
                             {meeting.location && (
                                <span className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" /> {meeting.location}
                                </span>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <h4 className="font-semibold text-lg">Agenda</h4>
                        <div className="space-y-4">
                            {meeting.agenda?.map((item, index) => (
                                <div key={item.id || `${meeting.id}-item-${index}`} className="p-3 rounded-lg border bg-background group">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-grow">
                                            <p>{item.text}</p>
                                            <p className="text-xs text-muted-foreground">Lagt til av: {item.addedBy?.name || 'Ukjent'}</p>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleMoveAgendaItem(meeting.id, index, 'up')} disabled={index === 0}>
                                                    <ArrowUp className="mr-2 h-4 w-4" />
                                                    Flytt opp
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleMoveAgendaItem(meeting.id, index, 'down')} disabled={index === meeting.agenda.length - 1}>
                                                    <ArrowDown className="mr-2 h-4 w-4" />
                                                    Flytt ned
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleRemoveAgendaItem(meeting.id, item)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Fjern punkt
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="pl-6 mt-2 space-y-2">
                                        {item.subItems?.map((subItem) => (
                                            <div key={subItem.id} className="flex items-start justify-between group text-sm">
                                                 <div className="flex-grow">
                                                    <p>{subItem.text}</p>
                                                    <p className="text-xs text-muted-foreground">Lagt til av: {subItem.addedBy?.name || 'Ukjent'}</p>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveSubItem(meeting.id, item.id, subItem)}>
                                                    <X className="h-3 w-3 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                        <div className="flex w-full items-center space-x-2 pt-2">
                                            <Input
                                                type="text"
                                                placeholder="Legg til underpunkt..."
                                                className="h-8 text-sm"
                                                value={newSubItemInputs[item.id] || ''}
                                                onChange={(e) => setNewSubItemInputs(prev => ({...prev, [item.id]: e.target.value}))}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleAddSubItem(meeting.id, item.id);
                                                }}
                                            />
                                            <Button size="sm" variant="outline" onClick={() => handleAddSubItem(meeting.id, item.id)}>
                                                <PlusCircle className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!meeting.agenda || meeting.agenda.length === 0) && (
                                <p className="text-sm text-muted-foreground list-none pl-0">Ingen agendapunkter lagt til.</p>
                            )}
                        </div>
                    </CardContent>

                  <CardFooter>
                    <div className="flex w-full items-center space-x-2">
                        <Input
                            type="text"
                            placeholder="Nytt agendapunkt..."
                            value={newAgendaItemInputs[meeting.id] || ''}
                            onChange={(e) => setNewAgendaItemInputs(prev => ({...prev, [meeting.id]: e.target.value}))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddAgendaItem(meeting.id);
                            }}
                        />
                        <Button onClick={() => handleAddAgendaItem(meeting.id)}>Legg til</Button>
                    </div>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <div className="text-center py-16 text-muted-foreground rounded-lg border border-dashed">
                <CalendarIcon className="mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-medium">Ingen møter</h3>
                <p className="mt-1 text-sm">Det er ingen møter planlagt for denne datoen.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

       <Dialog open={isNewMeetingDialogOpen} onOpenChange={setIsNewMeetingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planlegg nytt møte</DialogTitle>
            <DialogDescription>
              Opprett et nytt møte for den valgte datoen: {selectedDate ? format(selectedDate, "d. MMMM yyyy", { locale: nb }) : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Input
              placeholder="Møtetittel (f.eks. Styremøte #3)"
              value={newMeetingTitle}
              onChange={(e) => setNewMeetingTitle(e.target.value)}
            />
             <Input
              placeholder="Sted (f.eks. kontoret, digitalt)"
              value={newMeetingLocation}
              onChange={(e) => setNewMeetingLocation(e.target.value)}
            />
            <Input
              type="time"
              placeholder="Klokkeslett (f.eks. 18:00)"
              value={newMeetingTime}
              onChange={(e) => setNewMeetingTime(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewMeetingDialogOpen(false)}>Avbryt</Button>
            <Button onClick={handleAddMeeting}>Lagre møte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
