
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { 
    Building2, 
    Newspaper, 
    Users, 
    Share2, 
    Loader2, 
    Trash,
    Mail,
    Handshake,
    ListTodo,
    Calendar,
    Library,
    Instagram,
    FileText,
    Folder,
    FolderGit2,
    Landmark
} from "lucide-react";
import { useFirestore, useAuth } from "@/firebase/index";
import { doc, onSnapshot } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { revalidateAll } from "@/app/actions";

export default function DashboardPage() {
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const firestore = useFirestore();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<any | null>(null);

  useEffect(() => {
    if (!user || !firestore) {
      setPermissionsLoading(false);
      return;
    }

    const userDocRef = doc(firestore, "users", user.uid);
    const unsubPermissions = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserRole(data.role);
        setUserPermissions(data.permissions || {});
      }
      setPermissionsLoading(false);
    }, (error) => {
      console.error("Error fetching user permissions:", error);
      setPermissionsLoading(false);
    });

    return () => {
      unsubPermissions();
    };
  }, [user, firestore]);

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

  const StatCard = ({ title, href, icon: Icon, description }: { title: string; href: string; icon: React.ElementType; description: string; }) => {
    return (
      <Card asChild className="hover:bg-muted/50 transition-colors">
        <Link href={href}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle>{title}</CardTitle>
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{description}</p>
          </CardContent>
        </Link>
      </Card>
    );
  };
  
  if (permissionsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAdmin = userRole === 'Administrator';

  const dashboardItems = [
      { id: 'inbox', title: 'Innboks', href: '/dashboard/inbox', icon: Mail, description: 'Se og svar på meldinger og tips.' },
      { id: 'meetings', title: 'Møter', href: '/dashboard/meetings', icon: Handshake, description: 'Planlegg og administrer møteagendaer.' },
      { id: 'tasks', title: 'Oppgaver', href: '/dashboard/tasks', icon: ListTodo, description: 'Hold styr på oppgaver og ansvarsområder.' },
      { id: 'okonomi', title: 'Økonomi', href: '/dashboard/okonomi', icon: Landmark, description: 'Administrer budsjetter og utlegg.' },
      { id: 'buildings', title: 'Bygninger', href: '/dashboard/buildings', icon: Building2, description: 'Administrer bygningsdatabasen.' },
      { id: 'news', title: 'Nyheter', href: '/dashboard/news', icon: Newspaper, description: 'Skriv og publiser nyhetsartikler.' },
      { id: 'events', title: 'Arrangementer', href: '/dashboard/events', icon: Calendar, description: 'Lag og administrer arrangementer.' },
      { id: 'recommendations', title: 'Anbefalinger', href: '/dashboard/recommendations', icon: Library, description: 'Administrer anbefalte ressurser.' },
      { id: 'members', title: 'Brukere & Medlemmer', href: '/dashboard/members', icon: Users, description: 'Administrer brukere, roller og styreprofiler.' },
      { id: 'social', title: 'SoMe Planlegger', href: '/dashboard/social', icon: Share2, description: 'Planlegg innlegg for sosiale medier.' },
      { id: 'instagramLinks', title: 'Instagram Bio', href: '/dashboard/instagram-links', icon: Instagram, description: 'Administrer lenkene for /bio-siden.' },
      { id: 'textEditor', title: 'Tekstredigering', href: '/dashboard/text-editor', icon: FileText, description: 'En enkel editor for å skrive tekst.' },
      { id: 'files', title: 'Filutforsker', href: '/dashboard/files', icon: Folder, description: 'Last opp og administrer filer og bilder.' },
      { id: 'drive', title: 'Google Drive', href: '/dashboard/drive', icon: FolderGit2, description: 'Få tilgang til felles Google Drive-mappe.' },
  ];

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardItems.map((item) => (
          (isAdmin || userPermissions?.[item.id]?.read) && (
            <StatCard 
              key={item.id}
              title={item.title} 
              href={item.href} 
              icon={item.icon} 
              description={item.description} 
            />
          )
        ))}
        
        <Card className="sm:col-span-2 lg:col-span-4">
            <CardHeader>
                <CardTitle>Mellomlager (Cache)</CardTitle>
                <CardDescription>Tøm hurtigbufferen for hele nettstedet for å umiddelbart vise de siste endringene.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                    Når du gjør endringer, kan det ta noen minutter før de blir synlige for alle. Bruk denne knappen for å tvinge en umiddelbar oppdatering av alt innhold.
                </p>
                <Button onClick={handleRevalidate} disabled={isRevalidating}>
                    {isRevalidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
                    Tøm og oppdater alt innhold
                </Button>
            </CardContent>
        </Card>
      </div>
    </>
  )
}
