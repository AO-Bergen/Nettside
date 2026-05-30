

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PlusCircle, FolderOpen, Trash2, AlertTriangle, RefreshCw, Loader2, Save, GripVertical, MoreHorizontal, UserX, UserCog, Users, Edit, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useFirestore, useStorage } from "@/firebase/index";
import { collection, addDoc, doc, updateDoc, deleteDoc, query, onSnapshot, QueryDocumentSnapshot, DocumentData, orderBy, writeBatch, getDocs, Timestamp } from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { FileExplorer, SelectedFile } from "@/components/site/file-explorer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Building2, Newspaper, Share2, Folder as FolderIcon, Calendar, FileText, FolderGit2, Handshake, ListTodo, Library, Mail, Settings as SettingsIcon, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNowStrict } from 'date-fns';
import { nb } from 'date-fns/locale';


// --- Board Profiles Section ---
type BoardMember = { 
  id: string; 
  name: string; 
  role: string; 
  initials: string; 
  image: string;
  order: number;
};

const getBoardMemberInitials = (name: string) => {
  if (!name) return "";
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function BoardProfiles() {
  const firestore = useFirestore();
  const storage = useStorage();
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<BoardMember | null>(null);
  const [newMember, setNewMember] = useState({ name: '', role: '' });
  const { toast } = useToast();

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

 const fetchMembers = useCallback(() => {
    if (!firestore) return;
    setIsLoading(true);
    const q = query(collection(firestore, "members"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const membersData: BoardMember[] = [];
        let index = 0;
        querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
            const data = doc.data();
            membersData.push({
                id: doc.id,
                name: data.name,
                role: data.role,
                image: data.image || '',
                initials: getBoardMemberInitials(data.name),
                order: typeof data.order === 'number' ? data.order : index
            });
            index++;
        });
        membersData.sort((a,b) => a.order - b.order);
        setMembers(membersData);
        setIsLoading(false);
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: collection(firestore, "members").path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setIsLoading(false);
    });
    return unsubscribe;
  }, [firestore]);

  useEffect(() => {
    const unsubscribe = fetchMembers();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchMembers]);


  const handleAddMember = async () => {
    if (!firestore) return;
    if (newMember.name && newMember.role) {
      const newOrder = members.length > 0 ? Math.max(...members.map(m => m.order)) + 1 : 0;
      const dataToSave = {
        ...newMember,
        image: "",
        order: newOrder
      };
      const membersCollection = collection(firestore, "members");
      addDoc(membersCollection, dataToSave).then(() => {
        setNewMember({ name: '', role: '' });
        setIsAddDialogOpen(false);
        toast({ title: "Medlem lagt til", description: "Du kan legge til et bilde ved å redigere profilen."});
      }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: membersCollection.path,
            operation: 'create',
            requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    }
  };

  const handleUpdateMember = async () => {
    if (!firestore) return;
    if (selectedMember && selectedMember.id) {
      const memberDoc = doc(firestore, "members", selectedMember.id);
      const { id, initials, ...memberData } = selectedMember;
      updateDoc(memberDoc, memberData).then(() => {
        setSelectedMember(null);
        setIsEditDialogOpen(false);
        toast({ title: "Profil oppdatert"});
      }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: memberDoc.path,
            operation: 'update',
            requestResourceData: memberData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    }
  };

  const handleDeleteMember = async () => {
    if (!selectedMember || !firestore || !storage) return;
    
    const memberDoc = doc(firestore, "members", selectedMember.id);
    deleteDoc(memberDoc).then(() => {
        if (selectedMember.image) {
            try {
                const imageRef = storageRef(storage, selectedMember.image);
                deleteObject(imageRef);
            } catch (storageError: any) {
                if (storageError.code !== 'storage/object-not-found') {
                    console.warn("Could not delete image from storage:", storageError);
                }
            }
        }
        toast({ title: "Medlem slettet" });
        setIsDeleteDialogOpen(false);
        setIsEditDialogOpen(false);
        setSelectedMember(null);
    }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: memberDoc.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };
  
  const openEditDialog = (member: BoardMember) => {
    setSelectedMember({ ...member });
    setIsEditDialogOpen(true);
  };

  const handleFileSelect = (files: SelectedFile[]) => {
    if (selectedMember && files.length > 0) {
        setSelectedMember(prev => prev ? ({...prev, image: files[0].url}) : null);
    }
    setIsFileExplorerOpen(false);
  }
  
  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;

    let _members = [...members];
    const draggedItem = _members.splice(dragItem.current, 1)[0];
    _members.splice(dragOverItem.current, 0, draggedItem);
    
    dragItem.current = null;
    dragOverItem.current = null;

    setMembers(_members);
  };
  
  const handleSaveOrder = async () => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    members.forEach((member, index) => {
      const docRef = doc(firestore, "members", member.id);
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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-headline font-bold tracking-tight">Styreprofiler</h2>
            <p className="text-muted-foreground">Administrer profiler for styremedlemmer som vises på 'Om Oss'-siden.</p>
          </div>
          <div className="flex flex-col sm:flex-row w-full sm:w-auto items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchMembers} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                Oppdater
            </Button>
             <Button size="sm" variant="outline" onClick={handleSaveOrder}>
                <Save className="mr-2 h-4 w-4" />
                Lagre Rekkefølge
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                    <PlusCircle className="h-4 w-4" />
                    Legg til Styremedlem
                </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Legg til nytt styremedlem</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Navn</Label>
                    <Input id="name" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role" className="text-right">Rolle</Label>
                    <Input id="role" value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })} className="col-span-3" />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleAddMember}>Lagre</Button>
                </DialogFooter>
                </DialogContent>
            </Dialog>
          </div>
        </div>
        {isLoading ? (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {members.map((member, index) => (
                <div 
                    key={member.id}
                    className="cursor-move"
                    draggable
                    onDragStart={() => (dragItem.current = index)}
                    onDragEnter={() => (dragOverItem.current = index)}
                    onDragEnd={handleSort}
                    onDragOver={(e) => e.preventDefault()}
                >
                    <Card>
                        <CardHeader className="items-center">
                            <Avatar className="w-24 h-24 mb-4">
                            {member.image && <AvatarImage src={member.image} data-ai-hint="portrait person" className="object-cover" />}
                            <AvatarFallback>{member.initials}</AvatarFallback>
                            </Avatar>
                            <CardTitle className="font-headline">{member.name}</CardTitle>
                            <CardDescription>{member.role}</CardDescription>
                        </CardHeader>
                        <CardFooter className="flex justify-center gap-2">
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                            <Button variant="outline" className="w-full flex-grow" onClick={() => openEditDialog(member)}>Rediger</Button>
                        </CardFooter>
                    </Card>
                </div>
            ))}
            </div>
        )}

        {selectedMember && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                  <DialogTitle>Rediger profil</DialogTitle>
                  <DialogDescription>Endre informasjonen for {selectedMember.name}.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                <div className="grid gap-6 py-4 pr-2">
                    <div className="space-y-2">
                        <Label>Profilbilde</Label>
                        <div className="flex items-center gap-4">
                            <Avatar className="w-24 h-24">
                                {selectedMember.image && <AvatarImage src={selectedMember.image} className="object-cover" />}
                                <AvatarFallback>{getBoardMemberInitials(selectedMember.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-2">
                                <Button variant="outline" onClick={() => setIsFileExplorerOpen(true)}>
                                <FolderOpen className="mr-2 h-4 w-4" /> Velg bilde
                                </Button>
                                {selectedMember.image && (
                                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setSelectedMember({...selectedMember, image: ''})}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Fjern bilde
                                </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-name">Navn</Label>
                        <Input id="edit-name" value={selectedMember.name} onChange={(e) => setSelectedMember({ ...selectedMember, name: e.target.value, initials: getBoardMemberInitials(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-role">Rolle</Label>
                        <Input id="edit-role" value={selectedMember.role} onChange={(e) => setSelectedMember({ ...selectedMember, role: e.target.value })} />
                    </div>
                </div>
              </ScrollArea>
              <DialogFooter className="pt-4 sm:justify-between">
                  <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive">Slett</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle />
                                  Er du sikker?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                  Denne handlingen kan ikke angres. Dette vil permanent slette <strong>{selectedMember.name}</strong> og deres data.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Avbryt</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteMember}>Ja, slett</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                  <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Avbryt</Button>
                      <Button type="submit" onClick={handleUpdateMember}>Lagre endringer</Button>
                  </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

       <Dialog open={isFileExplorerOpen} onOpenChange={setIsFileExplorerOpen}>
        <DialogContent className="sm:max-w-7xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>File Explorer</DialogTitle>
            <DialogDescription>
              Select an image for the member.
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


// --- User & Roles Management Section ---

type Permissions = {
  [key: string]: { read: boolean; write: boolean; };
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  rolePresetId?: string;
  status: 'active' | 'deactivated';
  permissions: Permissions;
  createdAt?: Timestamp;
};

type Role = {
  id: string;
  name: string;
  permissions: Permissions;
};

const PERMISSIONS_CONFIG = [
    { id: 'inbox', label: 'Innboks', icon: Mail },
    { id: 'meetings', label: 'Møter', icon: Handshake },
    { id: 'tasks', label: 'Oppgaver', icon: ListTodo },
    { id: 'okonomi', label: 'Økonomi', icon: Landmark },
    { id: 'buildings', label: 'Bygninger', icon: Building2 },
    { id: 'news', label: 'Nyheter', icon: Newspaper },
    { id: 'events', label: 'Arrangementer', icon: Calendar },
    { id: 'recommendations', label: 'Anbefalinger', icon: Library },
    { id: 'members', label: 'Brukere & Medlemmer', icon: Users },
    { id: 'social', label: 'SoMe Planlegger', icon: Share2 },
    { id: 'instagramLinks', label: 'Instagram', icon: Users },
    { id: 'textEditor', label: 'Tekstredigering', icon: FileText },
    { id: 'files', label: 'Filutforsker', icon: FolderIcon },
    { id: 'drive', label: 'Google Drive', icon: FolderGit2 },
    { id: 'settings', label: 'Innstillinger', icon: SettingsIcon },
];

function DeactivateUserDialog({ userToDeactivate, onUserDeactivated }: { userToDeactivate: User; onUserDeactivated: () => void; }) {
    const firestore = useFirestore();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    const handleDeactivateUser = async () => {
        if (!firestore) return;
        try {
            const userDocRef = doc(firestore, 'users', userToDeactivate.id);
            await updateDoc(userDocRef, { status: 'deactivated' });
            toast({
                title: "Bruker deaktivert",
                description: `${userToDeactivate.name} har blitt deaktivert. De vil bli informert neste gang de logger inn.`,
            });
            onUserDeactivated();
        } catch (error) {
            toast({
                title: "Feil ved deaktivering",
                description: "Kunne ikke oppdatere brukerstatusen.",
                variant: "destructive",
            });
        } finally {
            setIsDialogOpen(false);
        }
    };

    return (
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                    Deaktiver bruker
                </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <UserX />
                        Deaktivere {userToDeactivate.name}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Dette vil hindre brukeren i å få tilgang til innholdet, men kontoen deres blir ikke slettet.
                        Neste gang de logger inn, vil de bli sendt til en side hvor de selv kan velge å slette kontoen sin permanent.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Avbryt</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeactivateUser}>Ja, deaktiver</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function UserManagement() {
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [isRolesLoading, setIsRolesLoading] = useState(true);
  const { toast } = useToast();
  const { auth } = useAuth();
  const firestore = useFirestore();
  const [users, setUsers] = useState<User[]>([]);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<Omit<User, 'id'>>({ name: '', email: '', role: 'Medlem', permissions: {}, status: 'active' });
  const userRoles = ["Administrator", "Medlem"];

  const [roles, setRoles] = useState<Role[]>([]);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'rolePresetName' | 'status', direction: 'ascending' | 'descending' }>({ key: 'name', direction: 'ascending' });


  const fetchUsers = useCallback(async () => {
    if (!firestore) return;
    setIsUsersLoading(true);
    try {
        const querySnapshot = await getDocs(collection(firestore, "users"));
        const usersData: User[] = [];
        querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
            const data = doc.data();
            const currentRole = data.role;
            const sanitizedRole = userRoles.includes(currentRole) ? currentRole : 'Medlem';
            usersData.push({ id: doc.id, status: 'active', permissions: {}, ...data, role: sanitizedRole } as User);
        });
        setUsers(usersData);
    } catch (error) {
        toast({
            title: "Feil ved henting av brukere",
            variant: "destructive"
        });
    } finally {
        setIsUsersLoading(false);
    }
  }, [firestore, toast]);

   const fetchRoles = useCallback(async () => {
    if (!firestore) return;
    setIsRolesLoading(true);
    const rolesCollection = collection(firestore, "roles");
    try {
        const querySnapshot = await getDocs(rolesCollection);
        const rolesData: Role[] = [];
        querySnapshot.forEach((doc) => {
            rolesData.push({ id: doc.id, ...doc.data() } as Role);
        });
        setRoles(rolesData);
    } catch (error) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: rolesCollection.path, operation: 'list' }));
    } finally {
        setIsRolesLoading(false);
    }
  }, [firestore]);

  useEffect(() => {
      fetchUsers();
      fetchRoles();
  }, [fetchUsers, fetchRoles]);

    const filteredAndSortedUsers = useMemo(() => {
        let sortableUsers = [...users];

        // Filtering
        if (searchTerm) {
          const lowercasedFilter = searchTerm.toLowerCase();
          sortableUsers = sortableUsers.filter(user =>
            user.name.toLowerCase().includes(lowercasedFilter) ||
            user.email.toLowerCase().includes(lowercasedFilter)
          );
        }

        // Sorting
        sortableUsers.sort((a, b) => {
          let aValue: string;
          let bValue: string;

          if (sortConfig.key === 'rolePresetName') {
            aValue = a.role === 'Administrator' ? 'Administrator' : roles.find(r => r.id === a.rolePresetId)?.name || 'Medlem';
            bValue = b.role === 'Administrator' ? 'Administrator' : roles.find(r => r.id === b.rolePresetId)?.name || 'Medlem';
          } else {
            aValue = a[sortConfig.key as keyof User] as string;
            bValue = b[sortConfig.key as keyof User] as string;
          }
          
          if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
          return 0;
        });

        return sortableUsers;
    }, [users, searchTerm, sortConfig, roles]);

    const handleOpenUserDialog = (user?: User) => {
        if (user) {
            const currentRole = user.role;
            const sanitizedRole = userRoles.includes(currentRole) ? currentRole : 'Medlem';
            setSelectedUser({ ...user, permissions: user.permissions || {}, role: sanitizedRole });
            setIsEditingUser(true);
        } else {
            setNewUser({ name: '', email: '', role: 'Medlem', permissions: {}, status: 'active' });
            setIsEditingUser(false);
        }
        setIsUserDialogOpen(true);
    };

    const handleCloseUserDialog = () => {
        setIsUserDialogOpen(false);
        setSelectedUser(null);
    };

    const handleSaveUser = async () => {
        if (!firestore) return;

        if (isEditingUser && selectedUser) {
            const userDoc = doc(firestore, "users", selectedUser.id);
            let dataToUpdate = { ...selectedUser };

            if (dataToUpdate.role === 'Administrator') {
                const allPermissions: Permissions = {};
                PERMISSIONS_CONFIG.forEach(p => {
                    allPermissions[p.id] = { read: true, write: true };
                });
                dataToUpdate.permissions = allPermissions;
            }

            const { id, ...finalData } = dataToUpdate;

            await updateDoc(userDoc, finalData);
            toast({ title: "Bruker oppdatert", description: `Tilganger for ${selectedUser.name} er oppdatert.` });
        } else {
            try {
                await addDoc(collection(firestore, "users"), { ...newUser });
                toast({ title: "Bruker invitert (simulert)", description: `${newUser.email} har blitt lagt til.` });
            } catch (error: any) {
                toast({ title: "Feil", description: `Kunne ikke legge til bruker: ${error.message}`, variant: "destructive" });
            }
        }
        handleCloseUserDialog();
        fetchUsers();
    };

    const handlePermissionChange = (pageId: string, type: 'read' | 'write', value: boolean, isRole: boolean) => {
        const updater = isRole ? setSelectedRole : isEditingUser ? setSelectedUser : setNewUser;
        updater((prev: any) => {
            if (!prev) return null;
            const newPermissions = { ...(prev.permissions || {}) };
            if (!newPermissions[pageId]) {
                newPermissions[pageId] = { read: false, write: false };
            }
            newPermissions[pageId] = { ...newPermissions[pageId], [type]: value };
            
            if (type === 'read' && !value) {
                newPermissions[pageId].write = false;
            }
            return { ...prev, permissions: newPermissions };
        });
    };
    
    const handleOpenRoleDialog = (role?: Role) => {
        if (role) {
            setSelectedRole({
              ...role,
              permissions: role.permissions ?? {},
            });
            setIsEditingRole(true);
        } else {
            setSelectedRole({ id: '', name: '', permissions: {} });
            setIsEditingRole(false);
        }
        setIsRoleDialogOpen(true);
    };

    const handleCloseRoleDialog = () => {
        setIsRoleDialogOpen(false);
        setSelectedRole(null);
    };

    const handleSaveRole = () => {
        if (!firestore || !selectedRole) return;

        if (!selectedRole.name || selectedRole.name.trim() === "") {
            toast({ title: "Navn mangler", variant: "destructive" });
            return;
        }
        
        if (isEditingRole && selectedRole.id) {
            const roleDoc = doc(firestore, "roles", selectedRole.id);
            const { id, ...dataToUpdate } = selectedRole;
            updateDoc(roleDoc, dataToUpdate).then(() => {
                toast({ title: "Rolle oppdatert" });
                handleCloseRoleDialog();
                fetchRoles();
            }).catch((serverError) => {
                 errorEmitter.emit('permission-error', new FirestorePermissionError({ path: roleDoc.path, operation: 'update', requestResourceData: dataToUpdate }));
            });
        } else {
            const rolesCollection = collection(firestore, "roles");
            const { id, ...dataToAdd } = selectedRole;
            addDoc(rolesCollection, dataToAdd).then(() => {
                toast({ title: "Rolle opprettet" });
                handleCloseRoleDialog();
                fetchRoles();
            }).catch((serverError) => {
                 errorEmitter.emit('permission-error', new FirestorePermissionError({ path: rolesCollection.path, operation: 'create', requestResourceData: dataToAdd }));
            });
        }
    };

    const handleDeleteRole = (roleId: string) => {
        if (!firestore) return;
        const roleDoc = doc(firestore, "roles", roleId);
        deleteDoc(roleDoc).then(() => {
            toast({ title: "Rolle slettet" });
            fetchRoles();
        }).catch((serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: roleDoc.path, operation: 'delete' }));
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                    <CardTitle>Roller (Forhåndsinnstillinger)</CardTitle>
                    <CardDescription>Definer maler for tillatelser for å raskt tildele dem til brukere.</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => handleOpenRoleDialog()}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Ny Rolle
                    </Button>
                </CardHeader>
                <CardContent>
                    {isRolesLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : (
                        <>
                            {/* Mobile View */}
                            <div className="md:hidden space-y-2">
                                {roles.length > 0 ? roles.map(role => (
                                    <div key={role.id} className="flex items-center justify-between rounded-lg border p-3 bg-card">
                                        <span className="font-medium">{role.name}</span>
                                        <div className="flex -mr-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenRoleDialog(role)}>Rediger</Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="text-destructive">Slett</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Slette rolle?</AlertDialogTitle>
                                                        <AlertDialogDescription>Er du sikker på at du vil slette rollen "{role.name}"?</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteRole(role.id)}>Slett</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                )) : <p className="text-sm text-muted-foreground text-center py-4">Ingen roller er opprettet.</p>}
                            </div>
                             {/* Desktop View */}
                            <div className="border rounded-lg overflow-x-auto hidden md:block">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Rollenavn</TableHead><TableHead className="text-right">Handlinger</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {roles.length > 0 ? roles.map(role => (
                                            <TableRow key={role.id}>
                                                <TableCell className="font-medium">{role.name}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleOpenRoleDialog(role)}>Rediger</Button>
                                                    <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive">Slett</Button></AlertDialogTrigger>
                                                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Slette rolle?</AlertDialogTitle><AlertDialogDescription>Er du sikker på at du vil slette rollen "{role.name}"?</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Avbryt</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteRole(role.id)}>Slett</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-center text-muted-foreground">Ingen roller er opprettet.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                    <CardTitle>Brukere og Tillatelser</CardTitle>
                    <CardDescription>
                        Administrer brukertilgang og roller for styrepanelet.
                    </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={isUsersLoading}>
                            {isUsersLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Oppdater
                        </Button>
                        <Button size="sm" onClick={() => handleOpenUserDialog()}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Legg til Bruker
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Søk etter navn eller e-post..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select
                            value={`${sortConfig.key}-${sortConfig.direction}`}
                            onValueChange={(value) => {
                                const [key, direction] = value.split('-');
                                setSortConfig({ key: key as any, direction: direction as any });
                            }}
                        >
                            <SelectTrigger className="w-full sm:w-[240px]">
                                <SelectValue placeholder="Sorter etter..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name-ascending">Navn (stigende)</SelectItem>
                                <SelectItem value="name-descending">Navn (synkende)</SelectItem>
                                <SelectItem value="rolePresetName-ascending">Rolle (stigende)</SelectItem>
                                <SelectItem value="rolePresetName-descending">Rolle (synkende)</SelectItem>
                                <SelectItem value="status-ascending">Status (stigende)</SelectItem>
                                <SelectItem value="status-descending">Status (synkende)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {isUsersLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                             {/* Mobile View */}
                            <div className="md:hidden space-y-4">
                               {filteredAndSortedUsers.length > 0 ? filteredAndSortedUsers.map((user) => (
                                    <Card key={user.id} onClick={() => setViewingUser(user)} className={cn('p-4 cursor-pointer', user.status === 'deactivated' && 'bg-muted/50')}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1 min-w-0">
                                                <p className="font-semibold truncate">{user.name}</p>
                                                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                                                <div className="flex items-center flex-wrap gap-2 pt-1">
                                                    <span className={cn('text-xs font-medium rounded-full px-2 py-1', user.status === 'deactivated' ? 'bg-destructive/20 text-destructive-foreground' : 'bg-green-500/20 text-green-700 dark:text-green-400')}>
                                                        {user.status === 'deactivated' ? 'Deaktivert' : 'Aktiv'}
                                                    </span>
                                                     <Badge variant="outline">{user.role === 'Administrator' ? 'Administrator' : roles.find((r) => r.id === user.rolePresetId)?.name || 'Medlem'}</Badge>
                                                </div>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button size="icon" variant="ghost" aria-haspopup="true" disabled={auth.currentUser?.uid === user.id} onClick={(e) => e.stopPropagation()}>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Åpne meny</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Handlinger</DropdownMenuLabel>
                                                    <DropdownMenuItem onSelect={() => handleOpenUserDialog(user)}>Endre rolle/tilganger</DropdownMenuItem>
                                                    <DeactivateUserDialog userToDeactivate={user} onUserDeactivated={fetchUsers} />
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </Card>
                                )) : <p className="text-sm text-muted-foreground text-center py-4">{searchTerm ? 'Ingen brukere matcher søket ditt.' : 'Ingen brukere er opprettet.'}</p>}
                            </div>
                            {/* Desktop View */}
                            <div className="border rounded-lg w-full overflow-x-auto hidden md:block">
                                <Table>
                                    <TableHeader>
                                    <TableRow>
                                        <TableHead>Navn</TableHead>
                                        <TableHead className="hidden sm:table-cell">E-post</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Rolle / Mal</TableHead>
                                        <TableHead>
                                        <span className="sr-only">Handlinger</span>
                                        </TableHead>
                                    </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {filteredAndSortedUsers.length > 0 ? filteredAndSortedUsers.map((user) => (
                                        <TableRow key={user.id} onClick={() => setViewingUser(user)} className={cn(user.status === 'deactivated' && 'bg-muted/50 hover:bg-muted/60', 'cursor-pointer')}>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell className="hidden sm:table-cell">{user.email}</TableCell>
                                        <TableCell>
                                        <span className={cn('text-xs font-medium rounded-full px-2 py-1', user.status === 'deactivated' ? 'bg-destructive/20 text-destructive-foreground' : 'bg-green-500/20 text-green-700 dark:text-green-400')}>
                                            {user.status === 'deactivated' ? 'Deaktivert' : 'Aktiv'}
                                        </span>
                                        </TableCell>
                                        <TableCell>
                                        {user.role === 'Administrator' ? 'Administrator' : roles.find((r) => r.id === user.rolePresetId)?.name || 'Medlem'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button size="icon" variant="ghost" aria-haspopup="true" disabled={auth.currentUser?.uid === user.id} onClick={(e) => e.stopPropagation()}>
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Åpne meny</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Handlinger</DropdownMenuLabel>
                                                <DropdownMenuItem onSelect={() => handleOpenUserDialog(user)}>Endre rolle/tilganger</DropdownMenuItem>
                                                <DeactivateUserDialog userToDeactivate={user} onUserDeactivated={fetchUsers} />
                                            </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground">{searchTerm ? 'Ingen brukere matcher søket ditt.' : 'Ingen brukere er opprettet.'}</TableCell>
                                        </TableRow>
                                    )}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!viewingUser} onOpenChange={(open) => !open && setViewingUser(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{viewingUser?.name}</DialogTitle>
                        <DialogDescription>{viewingUser?.email}</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-6 py-4">
                        <div className="space-y-1">
                            <Label className="text-sm text-muted-foreground">Rolle</Label>
                            <p className="font-medium">{viewingUser?.role === 'Administrator' ? 'Administrator' : roles.find(r => r.id === viewingUser?.rolePresetId)?.name || 'Medlem'}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-sm text-muted-foreground">Status</Label>
                            <div>
                                <Badge variant={viewingUser?.status === 'active' ? 'secondary' : 'destructive'} className={cn(viewingUser?.status === 'active' && 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300/50')}>{viewingUser?.status === 'active' ? 'Aktiv' : 'Deaktivert'}</Badge>
                            </div>
                        </div>
                        {viewingUser?.createdAt && (
                            <div className="col-span-2 space-y-1">
                                <Label className="text-sm text-muted-foreground">Medlem Siden</Label>
                                <p className="font-medium">
                                    {format(viewingUser.createdAt.toDate(), 'dd. MMMM yyyy', { locale: nb })}
                                    <span className="text-muted-foreground font-normal"> ({formatDistanceToNowStrict(viewingUser.createdAt.toDate(), { addSuffix: true, locale: nb })})</span>
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="space-y-4 pt-4 border-t">
                        <Label className="font-medium">Gjeldende Tillatelser</Label>
                        <ScrollArea className="h-64 pr-4">
                            <div className="space-y-4">
                                {PERMISSIONS_CONFIG.map(perm => {
                                    const canRead = viewingUser?.role === 'Administrator' || viewingUser?.permissions?.[perm.id]?.read;
                                    const canWrite = viewingUser?.role === 'Administrator' || viewingUser?.permissions?.[perm.id]?.write;
                                    return (
                                        <div key={perm.id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/50">
                                            <div className="flex items-center gap-3">
                                                <perm.icon className="h-5 w-5 text-muted-foreground" />
                                                <span>{perm.label}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-sm">Lese</Label>
                                                    <Switch checked={canRead} disabled />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-sm">Skrive</Label>
                                                    <Switch checked={canWrite} disabled />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewingUser(null)}>Lukk</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isUserDialogOpen} onOpenChange={handleCloseUserDialog}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isEditingUser ? 'Rediger Bruker' : 'Legg til ny bruker'}</DialogTitle>
                        <DialogDescription>
                            {isEditingUser 
                                ? 'Endre navn, rolle, status og tillatelser for denne brukeren.' 
                                : 'Inviter en ny bruker til styrepanelet.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="user-name">Navn</Label>
                            <Input id="user-name" 
                                value={(isEditingUser ? selectedUser?.name : newUser.name) || ''} 
                                onChange={(e) => isEditingUser 
                                    ? setSelectedUser(prev => ({...prev!, name: e.target.value})) 
                                    : setNewUser(prev => ({...prev, name: e.target.value}))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="user-email">E-post</Label>
                            <Input id="user-email" type="email" 
                                value={(isEditingUser ? selectedUser?.email : newUser.email) || ''} 
                                onChange={(e) => isEditingUser ? null : setNewUser(prev => ({...prev, email: e.target.value}))}
                                disabled={isEditingUser}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="user-role">Hovedrolle</Label>
                            <Select 
                                value={(isEditingUser ? selectedUser?.role : newUser.role) || ''}
                                onValueChange={(value) => {
                                    const updater = isEditingUser ? setSelectedUser : setNewUser;
                                    updater((prev: any) => ({ ...prev!, role: value }));
                                }}>
                                <SelectTrigger><SelectValue placeholder="Velg en rolle" /></SelectTrigger>
                                <SelectContent>
                                    {userRoles.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {isEditingUser && (
                            <div className="space-y-2">
                                <Label htmlFor="user-status">Status</Label>
                                <Select
                                    value={selectedUser?.status || 'active'}
                                    onValueChange={(value) =>
                                        setSelectedUser((prev) => ({ ...prev!, status: value as 'active' | 'deactivated' }))
                                    }>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Velg status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Aktiv</SelectItem>
                                        <SelectItem value="deactivated">Deaktivert</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                            <Label htmlFor="role-preset">Bruk forhåndsinnstilt rolle</Label>
                            <Select
                                value={(isEditingUser ? selectedUser?.rolePresetId : newUser.rolePresetId) || ''}
                                onValueChange={(roleId) => {
                                    const role = roles.find(r => r.id === roleId);
                                    if (role) {
                                        const updater = isEditingUser ? setSelectedUser : setNewUser;
                                        updater((prev: any) => ({ ...prev, permissions: role.permissions, rolePresetId: roleId }));
                                    }
                                }}
                            >
                                <SelectTrigger><SelectValue placeholder="Velg en mal for tilganger..." /></SelectTrigger>
                                <SelectContent>
                                    {roles.map(role => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Label className="font-medium">Individuelle Tillatelser</Label>
                        <CardDescription>
                            Administrator har alltid full tilgang. For rollen Medlem, styrer individuelle tillatelser tilgangen til dashbordet.
                        </CardDescription>
                        <ScrollArea className="h-64 pr-4">
                            <div className="space-y-4">
                                {PERMISSIONS_CONFIG.map(perm => {
                                    const currentPermissions = (isEditingUser ? selectedUser?.permissions : newUser.permissions) || {};
                                    const canRead = currentPermissions[perm.id]?.read || false;
                                    const canWrite = currentPermissions[perm.id]?.write || false;
                                    const isUserAdmin = (isEditingUser ? selectedUser?.role : newUser.role) === 'Administrator';

                                    return (
                                        <div key={perm.id} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50">
                                            <div className="flex items-center gap-3">
                                                <perm.icon className="h-5 w-5 text-muted-foreground" />
                                                <span>{perm.label}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <Label htmlFor={`${perm.id}-read`} className="text-sm">Lese</Label>
                                                    <Switch 
                                                        id={`${perm.id}-read`} 
                                                        checked={isUserAdmin || canRead}
                                                        onCheckedChange={(checked) => handlePermissionChange(perm.id, 'read', checked, false)}
                                                        disabled={isUserAdmin}
                                                    />
                                                </div>
                                                {canRead && (
                                                    <div className="flex items-center gap-2">
                                                        <Label htmlFor={`${perm.id}-write`} className="text-sm">Skrive</Label>
                                                        <Switch 
                                                            id={`${perm.id}-write`} 
                                                            checked={isUserAdmin || canWrite}
                                                            onCheckedChange={(checked) => handlePermissionChange(perm.id, 'write', checked, false)}
                                                            disabled={isUserAdmin}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                    
                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={handleCloseUserDialog}>Avbryt</Button>
                        <Button onClick={handleSaveUser}>Lagre</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRoleDialogOpen} onOpenChange={handleCloseRoleDialog}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isEditingRole ? 'Rediger Rolle' : 'Ny Rolle'}</DialogTitle>
                        <DialogDescription>
                            Definer et sett med tillatelser som kan brukes som en mal for brukere.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        <Label htmlFor="role-name">Rollenavn</Label>
                        <Input id="role-name"
                            value={selectedRole?.name || ''}
                            onChange={(e) => setSelectedRole(prev => ({...prev!, name: e.target.value}))}
                        />
                    </div>
                    <div className="space-y-4 pt-4 border-t">
                        <Label className="font-medium">Tillatelser for denne rollen</Label>
                        <ScrollArea className="h-72 pr-4">
                            <div className="space-y-4">
                                {PERMISSIONS_CONFIG.map(perm => {
                                    const canRead = selectedRole?.permissions?.[perm.id]?.read || false;
                                    const canWrite = selectedRole?.permissions?.[perm.id]?.write || false;
                                    return (
                                        <div key={perm.id} className="flex items-center justify-between p-2 rounded-lg border">
                                            <div className="flex items-center gap-3">
                                                <perm.icon className="h-5 w-5 text-muted-foreground" />
                                                <span>{perm.label}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <Label htmlFor={`${perm.id}-read-role`} className="text-sm">Lese</Label>
                                                    <Switch 
                                                        id={`${perm.id}-read-role`} 
                                                        checked={canRead}
                                                        onCheckedChange={(checked) => handlePermissionChange(perm.id, 'read', checked, true)}
                                                    />
                                                </div>
                                                {canRead && (
                                                    <div className="flex items-center gap-2">
                                                        <Label htmlFor={`${perm.id}-write-role`} className="text-sm">Skrive</Label>
                                                        <Switch 
                                                            id={`${perm.id}-write-role`} 
                                                            checked={canWrite}
                                                            onCheckedChange={(checked) => handlePermissionChange(perm.id, 'write', checked, true)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseRoleDialog}>Avbryt</Button>
                        <Button onClick={handleSaveRole}>Lagre Rolle</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function MembersPage() {
    return (
        <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="users"><UserCog className="mr-2"/>Alle Brukere</TabsTrigger>
                <TabsTrigger value="board-profiles"><Users className="mr-2"/>Styreprofiler</TabsTrigger>
            </TabsList>
            <TabsContent value="users">
                <UserManagement />
            </TabsContent>
            <TabsContent value="board-profiles">
                <BoardProfiles />
            </TabsContent>
        </Tabs>
    );
}


