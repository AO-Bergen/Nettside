

import { db } from "@/lib/firebase/server";
import { collection, getDocs, query, orderBy, Timestamp, doc, getDoc } from "firebase/firestore";
import Image from "next/image";
import { Header } from "@/components/site/header";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import { DEFAULT_LOGO, DEFAULT_ORG_NAME } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/site/footer";
import { Metadata } from "next";



type Event = {
  id: string;
  title: string;
  slug: string;
  description: string;
  location: string;
  eventDate: Timestamp;
  eventTime: string;
  imageUrl?: string;
  imageFocalPoint?: { x: number; y: number; };
};

async function getEvents(): Promise<Event[]> {
  try {
    const eventsQuery = query(collection(db, "events"), orderBy("eventDate", "desc"));
    const querySnapshot = await getDocs(eventsQuery);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Event));
  } catch (error) {
    console.error("Error fetching events:", error);
    return [];
  }
}

async function getSiteSettings() {
  try {
    const docRef = doc(db, "settings", "siteConfig");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as { logoUrl?: string; orgName?: string };
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

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = `Arrangementer | ${settings.orgName}`;
  const description = "Bli med på våre arrangementer, debatter og møter. Engasjer deg for en vakrere by!";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

const EventCard = ({ event }: { event: Event }) => {
  return (
    <Link href={`/events/${event.slug || event.id}`} className="group block">
      <Card className="flex flex-col h-full transition-all duration-300 ease-in-out hover:shadow-lg hover:-translate-y-1">
        {event.imageUrl && (
          <div className="relative aspect-video overflow-hidden rounded-t-lg">
            <Image
              src={event.imageUrl}
              alt={event.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              style={{
                objectPosition: `${event.imageFocalPoint?.x ?? 50}% ${event.imageFocalPoint?.y ?? 50}%`
              }}
              unoptimized
            />
          </div>
        )}
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{format(event.eventDate.toDate(), "EEEE, d. MMMM yyyy", { locale: nb })}</span>
          </CardDescription>
          <CardTitle className="font-headline text-2xl group-hover:text-primary transition-colors">
            {event.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{event.eventTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{event.location}</span>
          </div>
          <div className="pt-2 line-clamp-3">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              rehypePlugins={[rehypeRaw]}
              disallowedElements={["h1", "h2", "h3", "h4", "h5", "h6", "img"]}
            >
              {event.description}
            </ReactMarkdown>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="link" className="p-0">
            Les mer og se detaljer
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default async function EventsPage() {
  const events = await getEvents();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcomingEvents = events.filter((e) => e.eventDate.toDate() >= now);
  const pastEvents = events.filter((e) => e.eventDate.toDate() < now);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 py-12 md:py-20">
        <div className="container">
          <header className="mb-12 text-center">
            <h1 className="text-5xl md:text-7xl font-bold font-headline">Arrangementer</h1>
            <p className="mt-4 text-lg text-muted-foreground">Bli med på våre arrangementer og engasjer deg!</p>
          </header>

          {upcomingEvents.length > 0 && (
            <section className="mb-16">
              <h2 className="text-3xl font-headline font-bold mb-8 text-center">Kommende Arrangementer</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {pastEvents.length > 0 && (
            <section>
              <h2 className="text-3xl font-headline font-bold mb-8 text-center">Tidligere Arrangementer</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {pastEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {events.length === 0 && (
            <div className="text-center text-muted-foreground py-16">
              <p>Det er ingen planlagte arrangementer for øyeblikket. Følg med!</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
