

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import "react-image-crop/dist/ReactCrop.css";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sun, Moon, MoreHorizontal, PlusCircle, FolderOpen, Loader2, Info, Facebook, Instagram, Twitter, RefreshCw, AlertTriangle, UserX, Trash } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_LOGO,
  DEFAULT_ORG_NAME,
  DEFAULT_THEME,
  DEFAULT_HERO_IMAGE,
  DEFAULT_HERO_HEADING,
  DEFAULT_HERO_SUBHEADING,
  DEFAULT_LOGO_ATTRIBUTION,
  DEFAULT_HERO_ATTRIBUTION,
  DEFAULT_LIGHT_PRIMARY,
  DEFAULT_LIGHT_BACKGROUND,
  DEFAULT_LIGHT_ACCENT,
  DEFAULT_DARK_PRIMARY,
  DEFAULT_DARK_BACKGROUND,
  DEFAULT_DARK_ACCENT,
  DEFAULT_SOCIAL_FACEBOOK,
  DEFAULT_SOCIAL_INSTAGRAM,
  DEFAULT_SOCIAL_TWITTER
} from "@/lib/constants";
import { useAuth, useFirestore } from "@/firebase/index";
import { doc, getDoc, setDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, QueryDocumentSnapshot, DocumentData, getDocs } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileExplorer, SelectedFile } from "@/components/site/file-explorer";
import { User as FirebaseUser, deleteUser } from "firebase/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { revalidateAll } from "@/app/actions";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'deactivated';
};

type ThemeColors = {
  primary: string;
  background: string;
  accent: string;
};

const ALLOWED_ROLES = ["Administrator"];

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
            console.error("Error deactivating user:", error);
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

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const { auth } = useAuth();
  const firestore = useFirestore();
  const [orgName, setOrgName] = useState(DEFAULT_ORG_NAME);
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO);
  const [heroUrl, setHeroUrl] = useState(DEFAULT_HERO_IMAGE);
  const [heroHeading, setHeroHeading] = useState(DEFAULT_HERO_HEADING);
  const [heroSubheading, setHeroSubheading] = useState(DEFAULT_HERO_SUBHEADING);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [logoAttribution, setLogoAttribution] = useState(DEFAULT_LOGO_ATTRIBUTION);
  const [heroAttribution, setHeroAttribution] = useState(DEFAULT_HERO_ATTRIBUTION);
  const [facebookUrl, setFacebookUrl] = useState(DEFAULT_SOCIAL_FACEBOOK);
  const [instagramUrl, setInstagramUrl] = useState(DEFAULT_SOCIAL_INSTAGRAM);
  const [twitterUrl, setTwitterUrl] = useState(DEFAULT_SOCIAL_TWITTER);
  
  const [lightThemeColors, setLightThemeColors] = useState<ThemeColors>({
    primary: DEFAULT_LIGHT_PRIMARY,
    background: DEFAULT_LIGHT_BACKGROUND,
    accent: DEFAULT_LIGHT_ACCENT,
  });
  const [darkThemeColors, setDarkThemeColors] = useState<ThemeColors>({
    primary: DEFAULT_DARK_PRIMARY,
    background: DEFAULT_DARK_BACKGROUND,
    accent: DEFAULT_DARK_ACCENT,
  });

  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [imageTarget, setImageTarget] = useState<'logo' | 'hero' | null>(null);
  const [isRevalidating, setIsRevalidating] = useState(false);

  const [statusMessage, setStatusMessage] = useState("");

  // User Management State
  const [users, setUsers] = useState<User[]>([]);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Bidragsyter', password: '' });
  const userRoles = ["Administrator", "Styremedlem", "Bidragsyter", "Medlem"];

  const fetchSettings = useCallback(async () => {
    if (!firestore) return;
    try {
      const docRef = doc(firestore, "settings", "siteConfig");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setOrgName(data.orgName || DEFAULT_ORG_NAME);
        setLogoUrl(data.logoUrl || DEFAULT_LOGO);
        setHeroUrl(data.heroUrl || DEFAULT_HERO_IMAGE);
        setHeroHeading(data.heroHeading || DEFAULT_HERO_HEADING);
        setHeroSubheading(data.heroSubheading || DEFAULT_HERO_SUBHEADING);
        setTheme(data.theme || DEFAULT_THEME);
        setLogoAttribution(data.logoAttribution || DEFAULT_LOGO_ATTRIBUTION);
        setHeroAttribution(data.heroAttribution || DEFAULT_HERO_ATTRIBUTION);
        if (data.socialLinks) {
            setFacebookUrl(data.socialLinks.facebook || DEFAULT_SOCIAL_FACEBOOK);
            setInstagramUrl(data.socialLinks.instagram || DEFAULT_SOCIAL_INSTAGRAM);
            setTwitterUrl(data.socialLinks.twitter || DEFAULT_SOCIAL_TWITTER);
        }
        if (data.colors) {
          setLightThemeColors(data.colors.light || { primary: DEFAULT_LIGHT_PRIMARY, background: DEFAULT_LIGHT_BACKGROUND, accent: DEFAULT_LIGHT_ACCENT });
          setDarkThemeColors(data.colors.dark || { primary: DEFAULT_DARK_PRIMARY, background: DEFAULT_DARK_BACKGROUND, accent: DEFAULT_DARK_ACCENT });
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({
          title: "Feil ved henting av innstillinger",
          description: "Kunne ikke laste inn sideinnstillingene. Sjekk konsollen for feil.",
          variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [firestore, toast]);


  useEffect(() => {
    if (auth?.currentUser) {
        const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
        getDoc(userDocRef).then(userDoc => {
            if (userDoc.exists() && ALLOWED_ROLES.includes(userDoc.data().role)) {
                fetchSettings();
            } else {
                toast({ title: "Ingen tilgang", description: "Du har ikke rettigheter til å se innstillinger.", variant: "destructive" });
                router.replace('/dashboard');
            }
        });
    } else if (auth) { // Not loading, but no user
        router.replace('/login');
    }
  }, [auth, firestore, router, toast, fetchSettings]);


  const fetchUsers = useCallback(async () => {
    if (!firestore) return;
    setIsUsersLoading(true);
    try {
        const querySnapshot = await getDocs(collection(firestore, "users"));
        const usersData: User[] = [];
        querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
            const data = doc.data();
            usersData.push({ id: doc.id, status: 'active', ...data } as User);
        });
        setUsers(usersData);
    } catch (error) {
        console.error("Error fetching users:", error);
        toast({
            title: "Feil ved henting av brukere",
            description: "Kunne ikke laste inn brukerlisten. Sjekk konsollen for feil.",
            variant: "destructive"
        });
    } finally {
        setIsUsersLoading(false);
    }
  }, [firestore, toast]);

  useEffect(() => {
      fetchUsers();
  }, [fetchUsers]);

  const handleSave = async () => {
     if (!firestore) return;
     setStatusMessage("Lagrer...");
     try {
        const settingsData = {
            orgName,
            logoUrl,
            heroUrl,
            heroHeading,
            heroSubheading,
            logoAttribution,
            heroAttribution,
            theme,
            socialLinks: {
                facebook: facebookUrl,
                instagram: instagramUrl,
                twitter: twitterUrl,
            },
            colors: {
              light: lightThemeColors,
              dark: darkThemeColors,
            },
        };
        await setDoc(doc(firestore, "settings", "siteConfig"), settingsData, { merge: true });
        
        setStatusMessage("Innstillinger lagret! Laster siden på nytt for å se endringer...");
        setTimeout(() => window.location.reload(), 2000);

     } catch (error) {
        console.error("Error saving settings: ", error);
        setStatusMessage("Feil ved lagring.");
        toast({
            title: "Lagring feilet",
            description: "Kunne ikke lagre innstillingene.",
            variant: "destructive"
        });
        setTimeout(() => setStatusMessage(""), 5000);
     }
  };
  
  const handleThemeChange = (isDark: boolean) => {
      const newTheme = isDark ? 'dark' : 'light';
      setTheme(newTheme);
      document.documentElement.classList.toggle('dark', isDark);
  }

  const openFileExplorer = (target: 'logo' | 'hero') => {
    setImageTarget(target);
    setIsFileExplorerOpen(true);
  }

  const handleFileSelect = (files: SelectedFile[]) => {
    if (files.length === 0) {
        setIsFileExplorerOpen(false);
        setImageTarget(null);
        return;
    }
    const url = files[0].url;
    if (imageTarget === 'logo') {
        setLogoUrl(url);
    } else if (imageTarget === 'hero') {
        setHeroUrl(url);
    }
    setIsFileExplorerOpen(false);
    setImageTarget(null);
  }

    // --- User Management Handlers ---
    const handleOpenUserDialog = (user?: User) => {
        if (user) {
          setSelectedUser(user);
          setIsEditingUser(true);
        } else {
          setSelectedUser(null);
          setNewUser({ name: '', email: '', role: 'Bidragsyter', password: '' });
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
            // Update user role in Firestore
            const userDoc = doc(firestore, "users", selectedUser.id);
            await updateDoc(userDoc, { role: selectedUser.role, name: selectedUser.name, status: selectedUser.status });
            toast({ title: "Bruker oppdatert", description: `Rollen for ${selectedUser.email} er endret.` });
        } else {
            // NOTE: Creating a user with email/password requires a secure backend environment (e.g., Cloud Functions)
            // to avoid exposing auth credentials. This is a simplified client-side placeholder.
            // In a real app, you would call a Cloud Function here.
            try {
                // This is a placeholder. Firebase Admin SDK should be used for user creation on a server.
                await addDoc(collection(firestore, "users"), {
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                    status: 'active', // New users are active by default
                });

                toast({ title: "Bruker invitert (simulert)", description: `${newUser.email} har blitt lagt til. I en ekte app ville de fått en e-post for å sette passord.` });
                
            } catch (error: any) {
                console.error("Error adding user:", error);
                toast({ title: "Feil", description: `Kunne ikke legge til bruker: ${error.message}`, variant: "destructive" });
            }
        }
        handleCloseUserDialog();
        fetchUsers(); // Refresh the list
    };
    
    const handleRevalidate = async () => {
        setIsRevalidating(true);
        try {
            await revalidateAll();
            toast({
                title: "Mellomlager tømt!",
                description: "Innholdet på hele nettstedet vil bli oppdatert ved neste besøk.",
            });
        } catch (error) {
            console.error("Error revalidating:", error);
            toast({
                title: "Noe gikk galt",
                description: "Kunne ikke tømme mellomlageret.",
                variant: "destructive",
            });
        } finally {
            setIsRevalidating(false);
        }
    };


  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Generelle Innstillinger</CardTitle>
            <CardDescription>
              Endre navnet på organisasjonen og logoen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organisasjonsnavn</Label>
              <Input
                id="org-name"
                placeholder="Arkitekturopprøret Bergen"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Nåværende Logo</Label>
              <div className="flex items-center gap-4">
                  <Avatar className="w-20 h-20">
                      <AvatarImage src={logoUrl} />
                      <AvatarFallback>Logo</AvatarFallback>
                  </Avatar>
                  <Button variant="outline" onClick={() => openFileExplorer('logo')}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Velg fra Filutforsker
                  </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="logo-attribution">Logo Kilde/Attribusjon</Label>
              <Input
                id="logo-attribution"
                placeholder="F.eks. 'Eget design', 'Fotografens Navn'"
                value={logoAttribution}
                onChange={(e) => setLogoAttribution(e.target.value)}
              />
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Nettstedets Ikon (Favicon)</AlertTitle>
              <AlertDescription>
                For å endre ikonet som vises i nettleserfanen, må du erstatte filen `favicon.ico` i `public`-mappen i prosjektet. Du kan laste ned den nåværende logoen fra filutforskeren, konvertere den til et .ico-format (bruk et online verktøy), og laste den opp på nytt med navnet `favicon.ico`.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sosiale Medier</CardTitle>
            <CardDescription>Legg til lenker til organisasjonens sosiale medie-profiler.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="facebook-url">Facebook</Label>
              <div className="flex items-center gap-2">
                <Facebook className="h-5 w-5 text-muted-foreground" />
                <Input
                  id="facebook-url"
                  placeholder="https://facebook.com/dinside"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram-url">Instagram</Label>
              <div className="flex items-center gap-2">
                <Instagram className="h-5 w-5 text-muted-foreground" />
                <Input
                  id="instagram-url"
                  placeholder="https://instagram.com/dinside"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="twitter-url">X (Twitter)</Label>
               <div className="flex items-center gap-2">
                <Twitter className="h-5 w-5 text-muted-foreground" />
                <Input
                  id="twitter-url"
                  placeholder="https://x.com/dinside"
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Forsidebilde (Hero)</CardTitle>
            <CardDescription>Endre hovedbildet og teksten på forsiden.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nåværende forsidebilde</Label>
              <div className="flex items-center gap-4">
                  <Image src={heroUrl} width={200} height={112} alt="Current hero image" className="rounded-md border aspect-video object-cover" unoptimized/>
                  <Button variant="outline" onClick={() => openFileExplorer('hero')}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Velg fra Filutforsker
                  </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="hero-attribution">Hero Kilde/Attribusjon</Label>
              <Input
                id="hero-attribution"
                placeholder="F.eks. 'Unsplash', 'Fotografens Navn'"
                value={heroAttribution}
                onChange={(e) => setHeroAttribution(e.target.value)}
              />
            </div>

            <div className="space-y-2 pt-4 border-t mt-4">
              <Label htmlFor="hero-heading">Hovedoverskrift</Label>
              <Input
                id="hero-heading"
                placeholder="For en vakrere by"
                value={heroHeading}
                onChange={(e) => setHeroHeading(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hero-subheading">Underoverskrift</Label>
              <Textarea
                id="hero-subheading"
                placeholder="Vi kjemper for tradisjonell og klassisk arkitektur..."
                value={heroSubheading}
                onChange={(e) => setHeroSubheading(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle>Utseende og Tema</CardTitle>
            <CardDescription>
              Tilpass standard utseende og farger for nettstedet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Mørk Modus</Label>
                <CardDescription>
                  Sett mørk modus som standard for nye besøkende.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Sun className="h-5 w-5" />
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={handleThemeChange}
                  aria-label="Toggle Dark Mode"
                />
                <Moon className="h-5 w-5" />
              </div>
            </div>
            <Tabs defaultValue="light" className="w-full pt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="light">Lyst Tema Farger</TabsTrigger>
                <TabsTrigger value="dark">Mørkt Tema Farger</TabsTrigger>
              </TabsList>
              <TabsContent value="light" className="pt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="light-primary">Primary Farge (HSL)</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: `hsl(${lightThemeColors.primary})` }} />
                    <Input id="light-primary" value={lightThemeColors.primary} onChange={(e) => setLightThemeColors({...lightThemeColors, primary: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground">Format: H S% L% (f.eks. 120 25% 65%)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="light-background">Bakgrunnsfarge (HSL)</Label>
                   <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: `hsl(${lightThemeColors.background})` }} />
                    <Input id="light-background" value={lightThemeColors.background} onChange={(e) => setLightThemeColors({...lightThemeColors, background: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground">Format: H S% L% (f.eks. 60 56% 92%)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="light-accent">Accent Farge (HSL)</Label>
                   <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: `hsl(${lightThemeColors.accent})` }} />
                    <Input id="light-accent" value={lightThemeColors.accent} onChange={(e) => setLightThemeColors({...lightThemeColors, accent: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground">Format: H S% L% (f.eks. 56 31% 58%)</p>
                </div>
              </TabsContent>
              <TabsContent value="dark" className="pt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dark-primary">Primary Farge (HSL)</Label>
                   <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: `hsl(${darkThemeColors.primary})` }} />
                    <Input id="dark-primary" value={darkThemeColors.primary} onChange={(e) => setDarkThemeColors({...darkThemeColors, primary: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground">Format: H S% L% (f.eks. 120 25% 65%)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dark-background">Bakgrunnsfarge (HSL)</Label>
                   <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: `hsl(${darkThemeColors.background})` }} />
                    <Input id="dark-background" value={darkThemeColors.background} onChange={(e) => setDarkThemeColors({...darkThemeColors, background: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground">Format: H S% L% (f.eks. 120 5% 10%)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dark-accent">Accent Farge (HSL)</Label>
                   <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md border" style={{ backgroundColor: `hsl(${darkThemeColors.accent})` }} />
                    <Input id="dark-accent" value={darkThemeColors.accent} onChange={(e) => setDarkThemeColors({...darkThemeColors, accent: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground">Format: H S% L% (f.eks. 56 31% 58%)</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Mellomlager (Cache)</CardTitle>
                <CardDescription>Tøm hurtigbufferen for hele nettstedet for å umiddelbart vise de siste endringene.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                    Når du gjør endringer, kan det ta noen minutter før de blir synlige for alle. Bruk denne knappen for å tvinge en umiddelbar oppdatering av alt innhold på tvers av hele nettstedet.
                </p>
                 <Button onClick={handleRevalidate} disabled={isRevalidating}>
                    {isRevalidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
                    Tøm og oppdater alt innhold
                </Button>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Forklaring av Roller</CardTitle>
                <CardDescription>Oversikt over tilgangsnivåene for hver brukerrolle.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                    <li><strong className="text-foreground">Administrator:</strong> Full tilgang. Kan endre alle innstillinger og administrere brukere.</li>
                    <li><strong className="text-foreground">Styremedlem:</strong> Kan opprette og redigere alt innhold, men har ikke tilgang til Innstillinger.</li>
                    <li><strong className="text-foreground">Bidragsyter:</strong> Har lesetilgang til alt innhold i styrepanelet, men kan ikke redigere noe eller endre innstillinger.</li>
                    <li><strong className="text-foreground">Medlem:</strong> Har ikke tilgang til styrepanelet.</li>
                </ul>
            </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle>Brukere og Roller</CardTitle>
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
             {isUsersLoading ? (
                 <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
             ) : (
                <div className="border rounded-lg w-full overflow-x-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Navn</TableHead>
                        <TableHead className="hidden sm:table-cell">E-post</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Rolle</TableHead>
                        <TableHead>
                        <span className="sr-only">Handlinger</span>
                        </TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {users.map((user) => (
                        <TableRow key={user.id} className={cn(user.status === 'deactivated' && 'bg-muted/50 hover:bg-muted/60')}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="hidden sm:table-cell">{user.email}</TableCell>
                        <TableCell>
                          <span className={cn('text-xs font-medium rounded-full px-2 py-1', user.status === 'deactivated' ? 'bg-destructive/20 text-destructive-foreground' : 'bg-green-500/20 text-green-700 dark:text-green-400')}>
                            {user.status === 'deactivated' ? 'Deaktivert' : 'Aktiv'}
                          </span>
                        </TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" aria-haspopup="true" disabled={auth.currentUser?.uid === user.id}>
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Åpne meny</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Handlinger</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleOpenUserDialog(user)}>Endre rolle/status</DropdownMenuItem>
                                <DeactivateUserDialog userToDeactivate={user} onUserDeactivated={fetchUsers} />
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </div>
             )}
          </CardContent>
        </Card>

        <div className="flex items-center space-x-4">
          <Button onClick={handleSave}>Lagre Alle Innstillinger</Button>
          {statusMessage && (
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          )}
        </div>
      </div>
      <Dialog open={isFileExplorerOpen} onOpenChange={setIsFileExplorerOpen}>
        <DialogContent className="sm:max-w-7xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>File Explorer</DialogTitle>
            <DialogDescription>
              Select an image to insert into the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow min-h-0">
             <FileExplorer onFileSelect={handleFileSelect} isDialog={true} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isUserDialogOpen} onOpenChange={handleCloseUserDialog}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{isEditingUser ? 'Rediger Bruker' : 'Legg til ny bruker'}</DialogTitle>
                <DialogDescription>
                    {isEditingUser 
                        ? 'Endre navn, rolle og status for denne brukeren.' 
                        : 'Inviter en ny bruker til styrepanelet. De vil motta en e-post for å sette sitt passord (simulert).'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
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
                    <Label htmlFor="user-role">Rolle</Label>
                    <Select 
                        value={(isEditingUser ? selectedUser?.role : newUser.role) || ''}
                        onValueChange={(value) => isEditingUser 
                               ? setSelectedUser(prev => ({ ...prev!, role: value })) 
                               : setNewUser(prev => ({...prev, role: value}))
                        }>
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
            <DialogFooter>
                 <Button variant="outline" onClick={handleCloseUserDialog}>Avbryt</Button>
                <Button onClick={handleSaveUser}>Lagre</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

    

    