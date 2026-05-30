

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, Trash2, Calendar as CalendarIcon, CheckCircle2, Circle, Clock, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useFirestore } from "@/firebase/index";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, Timestamp, where, getDocs } from "firebase/firestore";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";


type BoardMember = {
    uid: string;
    name: string;
};

type Task = {
  id: string;
  title: string;
  description: string;
  assignedTo: {
    uid: string;
    name: string;
  };
  createdBy: {
    uid: string;
    name: string;
  };
  deadline: Timestamp | null;
  status: 'Ikke påbegynt' | 'Påbegynt' | 'Nesten ferdig' | 'Forsinket' | 'Ferdig';
  createdAt: Timestamp;
};

const taskStatuses = ['Ikke påbegynt', 'Påbegynt', 'Nesten ferdig', 'Forsinket', 'Ferdig'] as const;
type TaskStatus = typeof taskStatuses[number];

const emptyTask: Omit<Task, 'id' | 'createdAt' | 'createdBy'> = {
    title: '',
    description: '',
    assignedTo: { uid: '', name: '' },
    deadline: null,
    status: 'Ikke påbegynt',
};

const StatusIcon = ({ status }: { status: TaskStatus }) => {
    switch (status) {
        case 'Ikke påbegynt': return <Circle className="text-muted-foreground" />;
        case 'Påbegynt': return <Clock className="text-blue-500" />;
        case 'Nesten ferdig': return <Loader2 className="text-yellow-500 animate-spin" />;
        case 'Forsinket': return <AlertCircle className="text-orange-500" />;
        case 'Ferdig': return <CheckCircle2 className="text-green-500" />;
        default: return <Circle />;
    }
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Omit<Task, 'id' | 'createdAt' | 'createdBy'> & { id?: string }>(emptyTask);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "tasks"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(tasksData);
    },
    (error) => {
        const permissionError = new FirestorePermissionError({
            path: 'tasks',
            operation: 'list'
        });
        errorEmitter.emit('permission-error', permissionError);
    });

    const fetchBoardMembers = async () => {
        const q = query(collection(firestore, "users"), where("role", "in", ["Administrator", "Styremedlem"]));
        const querySnapshot = await getDocs(q);
        const members = querySnapshot.docs.map(doc => ({
            uid: doc.id,
            name: doc.data().name,
        }));
        setBoardMembers(members);
    };

    fetchBoardMembers();

    return () => unsubscribe();
  }, [firestore]);

  const handleOpenDialog = (task?: Task) => {
    if (task) {
      setSelectedTask(task);
      setIsEditing(true);
    } else {
      setSelectedTask(emptyTask);
      setIsEditing(false);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedTask(emptyTask);
  };

  const handleSaveTask = async () => {
    if (!user || !firestore) {
        toast({ title: "Du må være logget inn", variant: "destructive" });
        return;
    }
    if (!selectedTask.title || !selectedTask.assignedTo.uid || !selectedTask.deadline) {
        toast({ title: "Mangler informasjon", description: "Tittel, ansvarlig og frist må fylles ut.", variant: "destructive" });
        return;
    }

    const taskData = {
        ...selectedTask,
        createdBy: isEditing ? (selectedTask as Task).createdBy : { uid: user.uid, name: user.displayName || "Ukjent" },
        createdAt: isEditing ? (selectedTask as Task).createdAt : Timestamp.now(),
    };

    if (isEditing && selectedTask.id) {
        const taskDoc = doc(firestore, "tasks", selectedTask.id);
        const { id, ...dataToUpdate } = taskData;
        updateDoc(taskDoc, dataToUpdate).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: taskDoc.path,
                operation: 'update',
                requestResourceData: dataToUpdate
            });
            errorEmitter.emit('permission-error', permissionError);
        }).then(() => {
            toast({ title: "Oppgave oppdatert!" });
            handleCloseDialog();
        });
    } else {
        const tasksCollection = collection(firestore, "tasks");
        addDoc(tasksCollection, taskData).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: tasksCollection.path,
                operation: 'create',
                requestResourceData: taskData
            });
            errorEmitter.emit('permission-error', permissionError);
        }).then(() => {
            toast({ title: "Oppgave opprettet!" });
            handleCloseDialog();
        });
    }
  };

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    if (!firestore) return;
    const taskDoc = doc(firestore, "tasks", taskId);
    try {
        await updateDoc(taskDoc, { status });
        toast({ title: "Status oppdatert" });
    } catch (error) {
        const permissionError = new FirestorePermissionError({
            path: taskDoc.path,
            operation: 'update',
            requestResourceData: { status }
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete || !firestore) return;
    const taskDoc = doc(firestore, "tasks", taskToDelete.id);
    deleteDoc(taskDoc).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: taskDoc.path,
            operation: 'delete'
        });
        errorEmitter.emit('permission-error', permissionError);
    }).then(() => {
        toast({ title: "Oppgave slettet" });
        setTaskToDelete(null);
    });
  };
  
  const activeTasks = tasks.filter(task => task.status !== 'Ferdig');
  const completedTasks = tasks.filter(task => task.status === 'Ferdig');

  const renderTasksList = (tasksToRender: Task[], isMobile: boolean) => {
    if (tasksToRender.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-16 border rounded-lg border-dashed">
                <p>Ingen oppgaver her.</p>
            </div>
        );
    }

    if (isMobile) {
        return (
             <div className="space-y-4">
                {tasksToRender.map((task) => (
                    <Card key={task.id} className="p-4">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-grow min-w-0">
                                 <div className="flex items-center gap-2 mb-2">
                                    <StatusIcon status={task.status} />
                                    <span className="font-semibold">{task.status}</span>
                                </div>
                                <h3 className="font-semibold text-base leading-tight mb-1">{task.title}</h3>
                                <p className="text-sm text-muted-foreground">Ansvarlig: {task.assignedTo.name}</p>
                                <p className="text-sm text-muted-foreground">Frist: {task.deadline ? format(task.deadline.toDate(), "dd.MM.yyyy") : "-"}</p>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onSelect={() => handleOpenDialog(task)}>Rediger</DropdownMenuItem>
                                     <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>Endre status</DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                            <DropdownMenuSubContent>
                                                {taskStatuses.map(status => (
                                                    <DropdownMenuItem key={status} onSelect={() => handleStatusChange(task.id, status)}>
                                                        {status}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                    </DropdownMenuSub>
                                    <DropdownMenuItem onSelect={() => setTaskToDelete(task)} className="text-destructive">
                                    Slett
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </Card>
                ))}
             </div>
        );
    }

    return (
        <div className="border rounded-lg overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead className="w-[150px]">Status</TableHead>
                    <TableHead>Oppgave</TableHead>
                    <TableHead>Ansvarlig</TableHead>
                    <TableHead>Frist</TableHead>
                    <TableHead>Opprettet av</TableHead>
                    <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {tasksToRender.map((task) => (
                    <TableRow key={task.id}>
                    <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-start gap-2">
                                    <StatusIcon status={task.status} />
                                    {task.status}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                {taskStatuses.map(status => (
                                    <DropdownMenuItem key={status} onSelect={() => handleStatusChange(task.id, status)}>
                                        {status}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>{task.assignedTo.name}</TableCell>
                    <TableCell>{task.deadline ? format(task.deadline.toDate(), "dd.MM.yyyy") : "-"}</TableCell>
                    <TableCell>{task.createdBy.name}</TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => handleOpenDialog(task)}>Rediger</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setTaskToDelete(task)} className="text-destructive">
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
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Oppgavebehandler
            <Button onClick={() => handleOpenDialog()}>
              <PlusCircle className="mr-2" /> Ny Oppgave
            </Button>
          </CardTitle>
          <CardDescription>Administrer og følg opp styrets oppgaver.</CardDescription>
        </CardHeader>
        <CardContent>
            <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="active">Aktive Oppgaver ({activeTasks.length})</TabsTrigger>
                    <TabsTrigger value="completed">Ferdige Oppgaver ({completedTasks.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="active" className="mt-4">
                    <div className="md:hidden">
                        {renderTasksList(activeTasks, true)}
                    </div>
                     <div className="hidden md:block">
                        {renderTasksList(activeTasks, false)}
                    </div>
                </TabsContent>
                <TabsContent value="completed" className="mt-4">
                     <div className="md:hidden">
                        {renderTasksList(completedTasks, true)}
                    </div>
                     <div className="hidden md:block">
                        {renderTasksList(completedTasks, false)}
                    </div>
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Rediger oppgave' : 'Ny oppgave'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Tittel</Label>
              <Input id="title" value={selectedTask.title} onChange={(e) => setSelectedTask(p => ({...p, title: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beskrivelse</Label>
              <Textarea id="description" value={selectedTask.description} onChange={(e) => setSelectedTask(p => ({...p, description: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="assignedTo">Ansvarlig</Label>
                    <Select
                        value={selectedTask.assignedTo.uid}
                        onValueChange={(uid) => {
                            const member = boardMembers.find(m => m.uid === uid);
                            if (member) {
                                setSelectedTask(p => ({...p, assignedTo: member }));
                            }
                        }}
                    >
                        <SelectTrigger><SelectValue placeholder="Velg person" /></SelectTrigger>
                        <SelectContent>
                            {boardMembers.map(member => (
                                <SelectItem key={member.uid} value={member.uid}>{member.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="deadline">Frist</Label>
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedTask.deadline && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedTask.deadline ? format(selectedTask.deadline.toDate(), "PPP", { locale: nb }) : <span>Velg dato</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={selectedTask.deadline?.toDate()}
                            onSelect={(date) => setSelectedTask(p => ({...p, deadline: date ? Timestamp.fromDate(date) : null}))}
                            initialFocus
                            locale={nb}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Avbryt</Button>
            <Button onClick={handleSaveTask}>Lagre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette oppgaven "{taskToDelete?.title}" permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask}>Slett</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
