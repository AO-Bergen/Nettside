
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import "react-image-crop/dist/ReactCrop.css";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sun, Moon, FolderOpen, Loader2, Info, Facebook, Instagram, Twitter, Trash } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { FileExplorer, SelectedFile } from "@/components/site/file-explorer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { revalidateAll } from "@/app/actions";

type ThemeColors = {
  primary: string;
  background: string;
  accent: string;
};

const ALLOWED_ROLES = ["Administrator"];

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
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
    } else if (auth) { 
        router.replace('/login');
    }
  }, [auth, firestore, router, toast, fetchSettings]);

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
    </>
  );
}
