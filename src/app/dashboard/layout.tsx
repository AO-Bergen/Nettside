"use client"
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, LayoutDashboard, LogOut, Newspaper, Settings, Share2, Users, Loader2, Folder, Calendar, FileText, User, Instagram, Lightbulb, Mail, Handshake, ListTodo, Library, Bell, Home, FolderGit2, Lock, Landmark } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState, useEffect, createContext, useContext } from 'react';
import { DEFAULT_LOGO, DEFAULT_ORG_NAME } from '@/lib/constants';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc, collection, query, where, Timestamp } from "firebase/firestore";
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useFirestore, useAuth } from '@/firebase/index';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from '@/components/ui/scroll-area';

type Permissions = {
  [key: string]: { read: boolean; write: boolean };
} | null

const navItems = [
    { id: 'inbox', label: 'Innboks', icon: Mail, href: '/dashboard/inbox' },
    { id: 'meetings', label: 'Møter', icon: Handshake, href: '/dashboard/meetings' },
    { id: 'tasks', label: 'Oppgaver', icon: ListTodo, href: '/dashboard/tasks' },
    { id: 'okonomi', label: 'Økonomi', icon: Landmark, href: '/dashboard/okonomi' },
    { id: 'buildings', label: 'Bygninger', icon: Building2, href: '/dashboard/buildings' },
    { id: 'news', label: 'Nyheter', icon: Newspaper, href: '/dashboard/news' },
    { id: 'events', label: 'Arrangementer', icon: Calendar, href: '/dashboard/events' },
    { id: 'recommendations', label: 'Anbefalinger', icon: Library, href: '/dashboard/recommendations' },
    { id: 'members', label: 'Brukere & Medlemmer', icon: Users, href: '/dashboard/members' },
    { id: 'social', label: 'SoMe Planlegger', icon: Share2, href: '/dashboard/social' },
    { id: 'instagramLinks', label: 'Instagram', icon: Instagram, href: '/dashboard/instagram-links' },
    { id: 'textEditor', label: 'Tekstredigering', icon: FileText, href: '/dashboard/text-editor' },
    { id: 'files', label: 'Filutforsker', icon: Folder, href: '/dashboard/files' },
    { id: 'drive', label: 'Google Drive', icon: FolderGit2, href: '/dashboard/drive' },
];

const PermissionsContext = createContext<{ permissions: Permissions; isAdmin: boolean }>({
  permissions: null,
  isAdmin: false,
});

export const useDashboardPermissions = () => useContext(PermissionsContext);


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


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { user, auth, loading: isAuthLoading, openAuthDialog } = useAuth();
  const firestore = useFirestore();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<Permissions>(null);

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');
  const [logoSrc, setLogoSrc] = useState(DEFAULT_LOGO);
  const [orgName, setOrgName] = useState(DEFAULT_ORG_NAME);
  
  const [unsub, setUnsub] = useState<() => void>(() => () => {});

  const [taskNotifications, setTaskNotifications] = useState<Task[]>([]);
  const [messageNotifications, setMessageNotifications] = useState<Message[]>([]);

  const isAdmin = userRole === "Administrator";
  
  const currentNavItem = navItems.find(item => isActive(item.href));
  const pageId = currentNavItem?.id;
  const hasWriteAccess = isAdmin || (pageId && userPermissions ? userPermissions[pageId]?.write : false);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
        router.replace('/');
        openAuthDialog();
        return;
    }
    
    if (!firestore) return;

    const userDocRef = doc(firestore, "users", user.uid);
    
    const unsubscribe = onSnapshot(userDocRef, (userDocSnap) => {
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const role = userData.role;
        const status = userData.status || 'active';
        
        setUserRole(role);
        setUserPermissions(userData.permissions || {});

        if (status === 'deactivated') {
          signOut(auth).then(() => router.replace('/my-profile/deactivated'));
          return;
        }

        if (role !== 'Administrator' && (!userData.permissions || Object.values(userData.permissions).every(p => !(p as any).read))) {
            toast({
                title: "Ingen tilgang",
                description: "Du har ikke tilgang til noen sider i styrepanelet.",
                variant: "destructive"
            });
            signOut(auth).then(() => router.replace('/'));
        }

      } else {
        toast({
          title: "Bruker ikke funnet",
          description: "Kunne ikke verifisere brukerdata. Vennligst logg inn på nytt.",
          variant: "destructive"
        });
        signOut(auth).then(() => router.replace('/'));
      }
    }, (serverError) => {
      const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'get',
      });
      errorEmitter.emit('permission-error', permissionError);
      signOut(auth).then(() => router.replace('/'));
    });
    
    setUnsub(() => unsubscribe);

    return () => unsubscribe();
  }, [user, auth, firestore, isAuthLoading, router, toast, openAuthDialog]);

  useEffect(() => {
    if (!user || !firestore || !userRole || !userPermissions) return;

    let tasksUnsub = () => {};
    if (isAdmin || userPermissions?.tasks?.read) {
        try {
            const tasksQuery = query(
                collection(firestore, "tasks"),
                where("assignedTo.uid", "==", user.uid),
                where("status", "in", ["Ikke påbegynt", "Påbegynt", "Nesten ferdig", "Forsinket"])
            );
            tasksUnsub = onSnapshot(tasksQuery, (snapshot) => {
                const newTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
                setTaskNotifications(newTasks);
            }, (error) => {
                console.error("Error fetching task notifications:", error);
            });
        } catch(e) {
             console.error("Error creating task query:", e);
        }
    } else {
        setTaskNotifications([]);
    }


    let messagesUnsub = () => {};
    if (isAdmin || userPermissions?.inbox?.read) {
        try {
            const messagesQuery = query(
                collection(firestore, "messages"),
                where("isRead", "==", false),
                where("status", "==", "inbox")
            );
            messagesUnsub = onSnapshot(messagesQuery, (snapshot) => {
                const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
                setMessageNotifications(newMessages);
            }, (error) => {
                console.error("Error fetching message notifications:", error);
            });
        } catch(e) {
            console.error("Error creating message query:", e);
        }
    } else {
        setMessageNotifications([]);
    }

    return () => {
        tasksUnsub();
        messagesUnsub();
    };
  }, [user, firestore, userRole, userPermissions, isAdmin]);


  useEffect(() => {
    if (!firestore) return;
    const docRef = doc(firestore, "settings", "siteConfig");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLogoSrc(data.logoUrl || DEFAULT_LOGO);
        setOrgName(data.orgName || DEFAULT_ORG_NAME);
      }
    });

    return () => unsubscribe();
  }, [firestore]);

  const handleLogout = async () => {
    if(unsub) unsub();
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (isAuthLoading || !userRole) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const notificationCount = taskNotifications.length + messageNotifications.length;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
             <Avatar className="size-8">
                <AvatarImage src={logoSrc} />
                <AvatarFallback>AB</AvatarFallback>
            </Avatar>
            <h2 className="text-lg font-headline font-semibold">{orgName}</h2>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive('/dashboard')} tooltip="Oversikt">
                <Link href="/dashboard">
                  <LayoutDashboard />
                  <span>Oversikt</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {navItems.map(item => (
                (isAdmin || userPermissions?.[item.id]?.read) && (
                    <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                            <Link href={item.href}>
                                <item.icon />
                                <span>{item.label}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                )
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
           <SidebarMenu>
            {(isAdmin || userPermissions?.settings?.read) && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/dashboard/settings')} tooltip="Innstillinger">
                  <Link href="/dashboard/settings">
                    <Settings />
                    <span>Innstillinger</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
             <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive('/my-profile')} tooltip="Min Profil">
                <Link href="/my-profile">
                  <User />
                  <span>Min Profil</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Logg ut">
                <LogOut />
                <span>Logg ut</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-card px-6">
            <SidebarTrigger className="lg:hidden"/>
            <div className="flex-1">
                <h1 className="text-lg font-semibold font-headline flex items-center gap-2">
                    {currentNavItem?.label || 'Oversikt'}
                    {currentNavItem && !hasWriteAccess && <Lock className="h-4 w-4 text-muted-foreground" />}
                </h1>
            </div>
            <div className="flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative h-8 w-8">
                            <Bell className="h-5 w-5" />
                            {notificationCount > 0 && (
                                <span className="absolute top-1 right-1 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                        <DropdownMenuLabel>Varsler ({notificationCount})</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {notificationCount > 0 ? (
                            <ScrollArea className="max-h-80">
                                {taskNotifications.map(task => (
                                    <DropdownMenuItem key={`task-${task.id}`} asChild>
                                        <Link href="/dashboard/tasks" className="flex items-start">
                                            <ListTodo className="mr-2 h-4 w-4 mt-1 shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="font-semibold">Ny oppgave til deg</span>
                                                <span className="text-sm text-muted-foreground truncate">{task.title}</span>
                                            </div>
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                                {messageNotifications.map(message => (
                                    <DropdownMenuItem key={`msg-${message.id}`} asChild>
                                        <Link href="/dashboard/inbox" className="flex items-start">
                                            <Mail className="mr-2 h-4 w-4 mt-1 shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="font-semibold">Ny melding</span>
                                                <span className="text-sm text-muted-foreground truncate">Fra: {message.name}</span>
                                            </div>
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </ScrollArea>
                        ) : (
                            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                Ingen nye varsler
                            </div>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button asChild variant="outline">
                    <Link href="/">
                        <Home className="h-4 w-4 md:mr-2" />
                        <span className="md:not-sr-only sr-only">Tilbake til Hjemmeside</span>
                    </Link>
                </Button>
             </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 flex flex-col">
            <PermissionsContext.Provider value={{ permissions: userPermissions, isAdmin }}>
                {children}
            </PermissionsContext.Provider>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
