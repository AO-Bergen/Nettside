
'use client';

import React, { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase/server";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  type Timestamp,
} from "firebase/firestore";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableRow, TableCell } from "@/components/ui/table";
import Link from "next/link";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import { MapPin, Info, History, ExternalLink, Loader2 } from "lucide-react";
import { BuildingMap } from "@/components/site/building-map";
import { Button } from "@/components/ui/button";
import { EditButton } from "@/components/site/edit-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BuildingVote } from "@/components/site/building-vote";
import { Carousel, CarouselApi, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

import type { Building } from '@/types/building';

const verneklasseInfo: Record<string, { name: string; description: string }> = {
  fredet: {
    name: "Fredet",
    description:
      "Høyeste vernestatus. Kulturminnet er automatisk eller vedtaksfredet. Alle endringer krever tillatelse fra myndighetene.",
  },
  verneverdig: {
    name: "Verneverdig",
    description:
      "Kulturminne identifisert som verneverdig etter faglig vurdering. Ikke fredet, men underlagt søknadsplikt ved endringer.",
  },
  bevaringsverdig: {
    name: "Bevaringsverdig",
    description:
      "Bygning i bevaringsområde eller hensynssone. Tiltak og fasadeendringer er søknadspliktige.",
  },
  automatisk_fredet: {
    name: "Automatisk fredet",
    description:
      "Gjelder kulturminner eldre enn 1537 (bygninger, ruiner) og samiske kulturminner eldre enn 100 år. Vernet er automatisk.",
  },
  ikke_vurdert: {
    name: "Ikke vurdert / ukjent",
    description:
      "Bygning som ikke er registrert i verneplan, men kan likevel ha lokal eller arkitektonisk verdi.",
  },
};

type Article = {
  id: string;
  title: string;
  date: Timestamp;
};

const parseCiteWeb = (citeString: string) => {
  if (!citeString || !citeString.trim().startsWith("{{cite web")) return null;
  const content = citeString
    .slice(citeString.indexOf("{{cite web") + 10, citeString.lastIndexOf("}}"))
    .trim();
  const pairs = content
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const result: Record<string, string> = {};
  pairs.forEach((pair) => {
    const firstEqual = pair.indexOf("=");
    if (firstEqual > -1) {
      const key = pair.substring(0, firstEqual).trim();
      const value = pair.substring(firstEqual + 1).trim();
      result[key] = value;
    }
  });
  return Object.keys(result).length > 0 ? result : null;
};

const Attribution = ({ attribution }: { attribution?: string }) => {
  if (!attribution) return null;
  const parsed = parseCiteWeb(attribution);

  if (parsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded cursor-help">
              Bilde: <span className="underline">{parsed.author || parsed.publisher || "Kilde"}</span>
            </p>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs" side="top" align="end">
            <ul className="space-y-1 text-xs">
              {parsed.title && (
                <li>
                  <strong>Tittel:</strong> {parsed.title}
              </li>
              )}
              {parsed.author && (
                <li>
                  <strong>Opphav:</strong> {parsed.author}
              </li>
              )}
              {parsed.publisher && (
                <li>
                  <strong>Utgiver:</strong> {parsed.publisher}
              </li>
              )}
              {parsed.url && (
                <li>
                  <a
                    href={parsed.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    Gå til kilde <ExternalLink className="h-3 w-3" />
                  </a>
              </li>
              )}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <p className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
      Bilde: {attribution}
    </p>
  );
};


export function BuildingPageClient({ id }: { id: string }) {
  const [building, setBuilding] = useState<Building | null>(null);
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    async function getBuilding(identifier: string): Promise<Building | null> {
      try {
        let buildingDoc: any = null;

        const q = query(collection(db, "projects"), where("slug", "==", identifier), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          buildingDoc = querySnapshot.docs[0];
        } else {
          const docRef = doc(db, "projects", identifier);
          const docSnapById = await getDoc(docRef);
          if (docSnapById.exists()) {
            buildingDoc = docSnapById;
          }
        }

        if (!buildingDoc) return null;
        return { id: buildingDoc.id, ...buildingDoc.data() } as Building;
      } catch (error) {
        console.error(`Error fetching building ${identifier}:`, error);
        return null;
      }
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
        return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as Article);
      } catch (e) {
        console.error("Error fetching recent news:", e);
        return [];
      }
    }
    
    async function loadData() {
        setIsLoading(true);
        const [buildingData, articlesData] = await Promise.all([
            getBuilding(id),
            getRecentNews()
        ]);
        
        if (!buildingData) {
            notFound();
        }

        setBuilding(buildingData);
        setRecentArticles(articlesData);
        setIsLoading(false);
    }
    loadData();

  }, [id]);

  useEffect(() => {
    if (!api) return;
    
    const updateCurrent = () => {
      const selected = api.selectedScrollSnap();
      setCurrent(selected + 1);
      
      // Auto-scroll thumbnail into view
      const thumbnailElement = document.getElementById(`thumbnail-${selected}`);
      if (thumbnailElement) {
        thumbnailElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    };
    
    // Set initial state
    updateCurrent();
    
    // Listen for changes
    api.on("select", updateCurrent);
    
    return () => {
      api.off("select", updateCurrent);
    };
  }, [api]);

  const onThumbClick = useCallback(
    (index: number) => {
      api?.scrollTo(index)
    },
    [api]
  )

  if (isLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )
  }

  if (!building) {
    return null; // Should be handled by notFound, but good practice
  }

  const hasCoordinates =
    typeof building.latitude === "number" && typeof building.longitude === "number";

  const verneklasseKey = building.verneklasse ?? "ikke_vurdert";
  const verneklasseDisplay =
    verneklasseInfo[verneklasseKey] ??
    ({ name: building.verneklasse ?? "Ukjent", description: "Ingen detaljert informasjon." } as const);

  const details: Record<string, React.ReactNode> = {
    Adresse: building.address,
    Status: building.status,
    Verneklasse: verneklasseDisplay.name,
    Epoke: building.epoch,
    Stil: building.style,
    Understil: building.subStyle,
    Arkitekt: building.arkitekt,
    Eier: building.owner,
    Byggeår: building.constructionYear,
    Ferdigstilt: building.completionYear,
  };

  const images = building.imageUrls || [];
  const attributions = building.imageAttributions || [];

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 py-8 md:py-16 bg-muted/30">
        <div className="container">
          <div className="grid lg:grid-cols-3 gap-8 md:gap-12">
            <div className="lg:col-span-2 overflow-x-hidden">
              {images.length > 0 && (
  <div className="mb-6 md:mb-8 overflow-x-hidden">
    <Carousel 
      className="w-full relative" 
      setApi={setApi}
      opts={{
        loop: true,
        align: "start",
      }}
    >
      <CarouselContent>
        {images.map((url, index) => (
          <CarouselItem key={index}>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
              <Image
                src={url}
                alt={`${building.name} - bilde ${index + 1}`}
                fill
                className="object-cover"
                unoptimized
                priority={index === 0}
              />
              <Attribution attribution={attributions[index]} />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="absolute top-1/2 -translate-y-1/2 left-4 z-10 flex" />
      <CarouselNext className="absolute top-1/2 -translate-y-1/2 right-4 z-10 flex" />
    </Carousel>
    {images.length > 1 && (
      <div className="mt-4 w-full overflow-hidden">
        <ScrollArea className="w-full rounded-md">
          <div className="flex gap-2 p-2">
            {images.map((url, index) => (
              <button
                key={index}
                onClick={() => onThumbClick(index)}
                className="flex-shrink-0"
                id={`thumbnail-${index}`}
              >
                <div 
                  className={`relative h-16 w-24 rounded-md overflow-hidden transition-all border-2 ${
                    current === index + 1 
                      ? 'border-primary' 
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <Image 
                    src={url} 
                    alt={`Thumbnail ${index + 1}`} 
                    fill 
                    className="object-cover" 
                    unoptimized 
                  />
                </div>
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    )}
  </div>
)}

              <header className="mb-6 md:mb-8">
                <h1 className="text-3xl md:text-5xl font-bold font-headline">{building.name}</h1>
              </header>

              {building.description && (
                <div className="prose dark:prose-invert max-w-none mb-8 text-base md:text-lg">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    rehypePlugins={[rehypeRaw]}
                  >
                    {building.description}
                  </ReactMarkdown>
                </div>
              )}

              <BuildingVote buildingId={building.id} />

              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="font-headline text-xl md:text-2xl">Detaljer</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      {Object.entries(details).map(([key, value]) =>
                        value ? (
                          <TableRow key={key} className="text-sm md:text-base">
                            <TableCell className="font-semibold w-1/3">{key}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {value}
                                {key === "Verneklasse" && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Info className="h-4 w-4 text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="max-w-xs">{verneklasseDisplay.description}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {building.previouslyExisted && (
                <Card className="mt-8 border-dashed border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
                  <CardHeader>
                    <CardDescription>Vært på denne tomten tidligere:</CardDescription>
                    <CardTitle className="font-headline text-xl md:text-2xl flex items-center gap-2">
                      <History className="h-6 w-6" /> {building.previousName || "Hva som var her før"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {building.previousImageUrl && (
                      <div className="relative aspect-video mb-4 overflow-hidden rounded-lg border">
                        <Image
                          src={building.previousImageUrl}
                          alt={`Tidligere bygning på tomten til ${building.name}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <Attribution attribution={building.previousImageAttribution} />
                      </div>
                    )}
                    <Table>
                      <TableBody>
                        {building.previousConstructionYear && (
                          <TableRow>
                            <TableCell className="font-semibold">Byggeår</TableCell>
                            <TableCell>{building.previousConstructionYear}</TableCell>
                          </TableRow>
                        )}
                        {building.previousDemolitionYear && (
                          <TableRow>
                            <TableCell className="font-semibold">Fjernet</TableCell>
                            <TableCell>{building.previousDemolitionYear}</TableCell>
                          </TableRow>
                        )}
                        {building.previousArchitect && (
                          <TableRow>
                            <TableCell className="font-semibold">Arkitekt</TableCell>
                            <TableCell>{building.previousArchitect}</TableCell>
                          </TableRow>
                        )}
                        {building.demolitionReason && (
                          <TableRow>
                            <TableCell className="font-semibold">Årsak til fjerning</TableCell>
                            <TableCell>{building.demolitionReason}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    {building.previousInfoUrl && (
                      <Button asChild className="mt-4">
                        <Link href={building.previousInfoUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Les mer om den tidligere bygningen
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <aside className="lg:col-span-1 space-y-8">
              {hasCoordinates && (
                <div>
                  <h3 className="font-headline text-xl md:text-2xl mb-4 border-b pb-2 flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Posisjon på kartet
                  </h3>
                  <div className="relative aspect-square w-full h-64 md:h-80 rounded-lg overflow-hidden border">
                    <BuildingMap building={{...building, category: building.category || 'Ukjent'}} />
                  </div>
                  <Button asChild className="w-full mt-4">
                    <Link href="/buildings/map">Se alle bygninger på kartet</Link>
                  </Button>
                </div>
              )}

              {recentArticles.length > 0 && (
                <div>
                  <h3 className="font-headline text-xl md:text-2xl mb-4 border-b pb-2">Siste Nyheter</h3>
                  <div className="space-y-6">
                    {recentArticles.map((recent) => (
                      <Link href={`/news/${recent.id}`} key={recent.id} className="group block">
                        <h4 className="font-headline text-lg mb-1 group-hover:text-primary transition-colors">
                          {recent.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {format(recent.date.toDate(), "dd. MMMM yyyy", { locale: nb })}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>
      <EditButton editUrl={`/dashboard/buildings?edit=${building.id}`} />
      <Footer />
    </div>
  );
}
