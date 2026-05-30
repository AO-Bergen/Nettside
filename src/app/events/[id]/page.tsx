

import { db } from "@/lib/firebase/server";
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
import { Header } from "@/components/site/header";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { 
  DEFAULT_LOGO, 
  DEFAULT_ORG_NAME 
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/site/footer";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, MapPin, Clock, Ticket, User, Facebook, Info, ArrowLeft } from "lucide-react";
import { Metadata, ResolvingMetadata } from "next";
import { EditButton } from "@/components/site/edit-button";

type Participant = {
  name: string;
  role: string;
  imageUrl: string;
}

type EventDoc = {
  title: string;
  slug?: string;
  description?: string;
  location?: string;
  eventDate: Timestamp;
  eventTime?: string;
  imageUrl?: string;
  imageFocalPoint?: { x: number; y: number; };
  isPaid?: boolean;
  ticketUrl?: string;
  participants?: Participant[];
  facebookEventUrl?: string;
  updates?: string[];
};

type Article = {
  id: string;
  title: string;
  date: Timestamp;
};

async function fetchEvent(idOrSlug: string): Promise<(EventDoc & { id: string }) | null> {
  // First, try to find by slug
  const eventsQuery = query(collection(db, "events"), where("slug", "==", idOrSlug), limit(1));
  const querySnapshot = await getDocs(eventsQuery);

  if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...(docSnap.data() as EventDoc) };
  }

  // If not found by slug, fall back to checking by ID
  try {
    const byId = await getDoc(doc(db, "events", idOrSlug));
    if (byId.exists()) return { id: byId.id, ...(byId.data() as EventDoc) };
  } catch (error) {
    // This can happen if the ID is not a valid Firestore ID format.
    // In this case, we just return null.
  }
  
  return null;
}

async function getRecentNews(): Promise<Article[]> {
    try {
        const newsQuery = query(
            collection(db, "news"),
            where("status", "==", "Publisert"),
            orderBy("date", "desc"),
            limit(4)
        );
        const snapshot = await getDocs(newsQuery);
        return snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Article);
    } catch (e) {
        console.error("Error fetching recent news:", e);
        return [];
    }
}

async function getSiteSettings() {
    try {
        const docRef = doc(db, "settings", "siteConfig");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          return {
            logoUrl: data.logoUrl || DEFAULT_LOGO,
            orgName: data.orgName || DEFAULT_ORG_NAME,
          };
        }
      } catch (error) {
        console.error("Error fetching site settings:", error);
      }
      return { logoUrl: DEFAULT_LOGO, orgName: DEFAULT_ORG_NAME };
}

export async function generateStaticParams() {
  try {
    const querySnapshot = await getDocs(collection(db, "events"));
    const params: { id: string }[] = [];
    querySnapshot.forEach(doc => {
      params.push({ id: doc.id });
      const data = doc.data();
      if (data.slug) {
        params.push({ id: data.slug });
      }
    });
    return params;
  } catch (error) {
    console.error("Error generating static params for events:", error);
    return [];
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;
  const ev = await fetchEvent(id);
  
  if (!ev) {
    return {
      title: 'Arrangement ikke funnet',
    };
  }
  
  const description = ev.description ? ev.description.substring(0, 160).replace(/(\r\n|\n|\r)/gm, " ").trim() + '...' : `Detaljer for arrangementet ${ev.title}.`;

  return {
    title: ev.title,
    description: description,
    openGraph: {
        title: ev.title,
        description: description,
        type: 'article',
        images: ev.imageUrl ? [
            {
                url: ev.imageUrl,
                alt: ev.title,
            }
        ] : [],
    },
  };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    
    if (id === 'A3KwueDkbJI7W3cQSPeP') {
        redirect('/events/paneldebatt-hvem-har-skylden-for-at-det-bygges-sa-stygt-i-bergen');
    }

    const event = await fetchEvent(id);

    if (!event) {
        notFound();
    }
    const recentArticles = await getRecentNews();


    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 py-12 md:py-20">
                <div className="container">
                    <div className="grid lg:grid-cols-4 gap-12">
                        <article className="lg:col-span-3">
                             {event.imageUrl && (
                                <div className="relative aspect-video mb-8">
                                    <Image
                                        src={event.imageUrl}
                                        alt={event.title}
                                        fill
                                        className="rounded-lg object-cover"
                                        style={{ 
                                            objectPosition: `${event.imageFocalPoint?.x ?? 50}% ${event.imageFocalPoint?.y ?? 50}%` 
                                        }}
                                        unoptimized
                                        priority
                                    />
                                </div>
                            )}
                            <header className="mb-8">
                                <p className="text-muted-foreground mb-2">
                                    {format(event.eventDate.toDate(), 'EEEE, d. MMMM yyyy', { locale: nb })}
                                </p>
                                <h1 className="text-4xl md:text-5xl font-bold font-headline !mb-4">{event.title}</h1>
                                
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground">
                                    {event.eventTime && (
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4"/>
                                            <span>{event.eventTime}</span>
                                        </div>
                                    )}
                                    {event.location && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4"/>
                                            <span>{event.location}</span>
                                        </div>
                                    )}
                                </div>
                            </header>

                            <div className="flex flex-col sm:flex-row gap-2 mb-8">
                                {event.isPaid && event.ticketUrl && (
                                    <Button asChild className="w-full sm:w-auto">
                                        <Link href={event.ticketUrl} target="_blank" rel="noopener noreferrer">
                                            <Ticket className="w-4 h-4 mr-2" />
                                            Kjøp billett
                                        </Link>
                                    </Button>
                                )}
                                {event.facebookEventUrl && (
                                    <Button asChild variant="outline" className="w-full sm:w-auto">
                                        <Link href={event.facebookEventUrl} target="_blank" rel="noopener noreferrer">
                                            <Facebook className="w-4 h-4 mr-2" />
                                            Se på Facebook
                                        </Link>
                                    </Button>
                                )}
                            </div>

                            {event.description && (
                              <div className="prose dark:prose-invert max-w-none mb-8">
                                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>{event.description}</ReactMarkdown>
                              </div>
                            )}

                            {event.participants && event.participants.length > 0 && (
                                <div className="pt-12 mt-12 border-t">
                                    <h3 className="font-headline text-3xl mb-8 flex items-center gap-3">
                                        <User className="w-7 h-7"/>
                                        Deltakere på arrangementet
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8">
                                        {event.participants.map((p, index) => (
                                            <div key={index} className="flex flex-col items-center text-center gap-2">
                                                <Avatar className="w-24 h-24">
                                                    {p.imageUrl && <AvatarImage src={p.imageUrl} alt={p.name} className="object-cover"/>}
                                                    <AvatarFallback>{p.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-semibold">{p.name}</p>
                                                    <p className="text-sm text-muted-foreground">{p.role}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </article>
                        <aside className="lg:col-span-1 space-y-8">
                             {event.updates && event.updates.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="font-headline text-2xl flex items-center gap-2"><Info className="w-5 h-5"/>Oppdateringer</CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex flex-col gap-4">
                                      {event.updates.flatMap((update, index) => [
                                          <ReactMarkdown 
                                              key={`update-${index}`}
                                              remarkPlugins={[remarkGfm, remarkBreaks]} 
                                              rehypePlugins={[rehypeRaw]} 
                                              className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground"
                                          >
                                              {update}
                                          </ReactMarkdown>,
                                          index < event.updates!.length - 1 && <Separator key={`sep-${index}`} />
                                      ])}
                                    </CardContent>
                                </Card>
                             )}
                             <div>
                                <h3 className="font-headline text-2xl mb-4 border-b pb-2">Nyheter</h3>
                                <div className="space-y-6">
                                    {recentArticles.map(recent => (
                                        <Link href={`/news/${recent.id}`} key={recent.id} className="group block">
                                            <h4 className="font-headline text-lg mb-1 group-hover:text-primary transition-colors">{recent.title}</h4>
                                            <p className="text-sm text-muted-foreground">{format(recent.date.toDate(), 'dd. MMMM yyyy', { locale: nb })}</p>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </main>
            <EditButton editUrl={`/dashboard/events?edit=${event.id}`} />
            <Footer />
        </div>
    );
}
