'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Search, Building2, Newspaper, Calendar, Library, Lightbulb } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Command as CommandPrimitive } from 'cmdk';


// Simple debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<F>): void => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), waitFor);
    };
}

type BuildingResult = {
    id: string;
    slug?: string;
    name: string;
    address: string;
    imageUrl?: string;
}

type ArticleResult = {
    id: string;
    title: string;
    date: any; // Timestamp
    imageUrl?: string;
}

type EventResult = {
    id: string;
    slug?: string;
    title: string;
    eventDate: any; // Timestamp
    imageUrl?: string;
}

type RecommendationResult = {
    id: string;
    title: string;
    type: 'book' | 'documentary' | 'podcast';
    imageUrl?: string;
}

type PageResult = {
    path: string;
    title: string;
    description: string;
    icon: React.ElementType;
}

export function SearchDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const firestore = useFirestore();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [allBuildings, setAllBuildings] = useState<BuildingResult[]>([]);
  const [allArticles, setAllArticles] = useState<ArticleResult[]>([]);
  const [allEvents, setAllEvents] = useState<EventResult[]>([]);
  const [allRecommendations, setAllRecommendations] = useState<RecommendationResult[]>([]);
  const [staticPages] = useState<PageResult[]>([
    { path: '/tips-oss', title: 'Tips Oss', description: 'Send inn et tips om en bygning.', icon: Lightbulb },
    { path: '/anbefalinger', title: 'Anbefalinger', description: 'Se våre anbefalte ressurser.', icon: Library },
  ]);

  const [filteredBuildings, setFilteredBuildings] = useState<BuildingResult[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<ArticleResult[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventResult[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<RecommendationResult[]>([]);
  const [filteredPages, setFilteredPages] = useState<PageResult[]>([]);
  
  // Fetch all data once when the dialog opens
  useEffect(() => {
    if (!firestore || !open) return;

    const fetchData = async () => {
        if (allBuildings.length > 0) return; // Data already fetched
        
        setLoading(true);
        try {
            const buildingsQuery = query(collection(firestore, "projects"));
            const articlesQuery = query(collection(firestore, "news"), where("status", "==", "Publisert"));
            const eventsQuery = query(collection(firestore, "events"), orderBy("eventDate", "desc"));
            const recommendationsQuery = query(collection(firestore, "recommendations"), orderBy("order", "asc"));

            const [buildingsSnapshot, articlesSnapshot, eventsSnapshot, recommendationsSnapshot] = await Promise.all([
                getDocs(buildingsQuery),
                getDocs(articlesQuery),
                getDocs(eventsQuery),
                getDocs(recommendationsQuery),
            ]);

            const buildingsData = buildingsSnapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, slug: data.slug, name: data.name, address: data.address, imageUrl: data.imageUrls?.[0] } as BuildingResult
            });
            setAllBuildings(buildingsData);

            const articlesData = articlesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArticleResult));
            setAllArticles(articlesData);

            const eventsData = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventResult));
            setAllEvents(eventsData);

            const recommendationsData = recommendationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecommendationResult));
            setAllRecommendations(recommendationsData);

        } catch (e) {
            console.error("Error fetching search data:", e);
        }
        setLoading(false);
    };

    fetchData();
  }, [firestore, open, allBuildings]);


  const performSearch = (search: string) => {
    if (search.trim().length < 2) {
        setFilteredBuildings([]);
        setFilteredArticles([]);
        setFilteredEvents([]);
        setFilteredRecommendations([]);
        setFilteredPages([]);
        return;
    }

    const searchLower = search.toLowerCase();
    
    setFilteredBuildings(allBuildings.filter(b => b.name.toLowerCase().includes(searchLower) || b.address.toLowerCase().includes(searchLower)).slice(0, 5));
    setFilteredArticles(allArticles.filter(a => a.title.toLowerCase().includes(searchLower)).slice(0, 5));
    setFilteredEvents(allEvents.filter(e => e.title.toLowerCase().includes(searchLower)).slice(0, 5));
    setFilteredRecommendations(allRecommendations.filter(r => r.title.toLowerCase().includes(searchLower)).slice(0, 5));
    setFilteredPages(staticPages.filter(p => p.title.toLowerCase().includes(searchLower) || p.description.toLowerCase().includes(searchLower)));
  };

  const debouncedSearch = useMemo(() => debounce(performSearch, 200), [allBuildings, allArticles, allEvents, allRecommendations, staticPages]);

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);


  const handleSelect = (path: string) => {
    router.push(path);
    onOpenChange(false);
  };
  
  useEffect(() => {
      if (!open) {
          setSearchTerm('');
          setFilteredBuildings([]);
          setFilteredArticles([]);
          setFilteredEvents([]);
          setFilteredRecommendations([]);
          setFilteredPages([]);
      }
  }, [open]);

  const hasResults = filteredBuildings.length > 0 || filteredArticles.length > 0 || filteredEvents.length > 0 || filteredRecommendations.length > 0 || filteredPages.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-2xl">
        <DialogTitle className="sr-only">Søk på nettstedet</DialogTitle>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandPrimitive.Input
                value={searchTerm}
                onValueChange={setSearchTerm}
                placeholder="Søk etter bygninger, nyheter, arrangementer..."
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2"/>}
          </div>
          <CommandList>
            {searchTerm.length > 1 && !hasResults && !loading && (
                <CommandEmpty>Ingen resultater funnet for "{searchTerm}".</CommandEmpty>
            )}
            {filteredPages.length > 0 && (
                <CommandGroup heading="Sider">
                    {filteredPages.map(p => (
                        <CommandItem key={p.path} value={`page-${p.path}`} onSelect={() => handleSelect(p.path)} className="cursor-pointer">
                           <div className="flex items-center gap-4 w-full">
                               <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                                   <p.icon className="h-6 w-6 text-muted-foreground"/>
                               </div>
                               <div>
                                   <p className="font-medium">{p.title}</p>
                                   <p className="text-sm text-muted-foreground">{p.description}</p>
                               </div>
                           </div>
                        </CommandItem>
                    ))}
                </CommandGroup>
            )}
            {filteredBuildings.length > 0 && (
                <CommandGroup heading="Bygninger">
                    {filteredBuildings.map(b => (
                        <CommandItem key={b.id} value={`building-${b.id}`} onSelect={() => handleSelect(`/buildings/${b.slug || b.id}`)} className="cursor-pointer">
                            <div className="flex items-center gap-4 w-full">
                                {b.imageUrl ? (
                                    <Image src={b.imageUrl} alt={b.name} width={48} height={48} className="rounded-md object-cover w-12 h-12" unoptimized />
                                ) : (
                                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                                        <Building2 className="h-6 w-6 text-muted-foreground"/>
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium">{b.name}</p>
                                    <p className="text-sm text-muted-foreground">{b.address}</p>
                                </div>
                            </div>
                        </CommandItem>
                    ))}
                </CommandGroup>
            )}
            {filteredArticles.length > 0 && (
                 <CommandGroup heading="Nyheter">
                    {filteredArticles.map(a => (
                        <CommandItem key={a.id} value={`article-${a.id}`} onSelect={() => handleSelect(`/news/${a.id}`)} className="cursor-pointer">
                            <div className="flex items-center gap-4 w-full">
                                 {a.imageUrl ? (
                                    <Image src={a.imageUrl} alt={a.title} width={48} height={48} className="rounded-md object-cover w-12 h-12" unoptimized />
                                ) : (
                                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                                        <Newspaper className="h-6 w-6 text-muted-foreground"/>
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium">{a.title}</p>
                                    <p className="text-sm text-muted-foreground">{a.date ? format(a.date.toDate(), 'dd. MMMM yyyy', { locale: nb }) : ''}</p>
                                </div>
                            </div>
                        </CommandItem>
                    ))}
                </CommandGroup>
            )}
            {filteredEvents.length > 0 && (
                <CommandGroup heading="Arrangementer">
                   {filteredEvents.map(e => (
                       <CommandItem key={e.id} value={`event-${e.id}`} onSelect={() => handleSelect(`/events/${e.slug || e.id}`)} className="cursor-pointer">
                           <div className="flex items-center gap-4 w-full">
                                {e.imageUrl ? (
                                   <Image src={e.imageUrl} alt={e.title} width={48} height={48} className="rounded-md object-cover w-12 h-12" unoptimized />
                               ) : (
                                   <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                                       <Calendar className="h-6 w-6 text-muted-foreground"/>
                                   </div>
                               )}
                               <div>
                                   <p className="font-medium">{e.title}</p>
                                   <p className="text-sm text-muted-foreground">{e.eventDate ? format(e.eventDate.toDate(), 'dd. MMMM yyyy', { locale: nb }) : ''}</p>
                               </div>
                           </div>
                       </CommandItem>
                   ))}
               </CommandGroup>
            )}
            {filteredRecommendations.length > 0 && (
                <CommandGroup heading="Anbefalinger">
                   {filteredRecommendations.map(r => (
                       <CommandItem key={r.id} value={`recommendation-${r.id}`} onSelect={() => handleSelect(`/anbefalinger#${r.type}s`)} className="cursor-pointer">
                           <div className="flex items-center gap-4 w-full">
                                {r.imageUrl ? (
                                   <Image src={r.imageUrl} alt={r.title} width={48} height={48} className="rounded-md object-cover w-12 h-12" unoptimized />
                               ) : (
                                   <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                                       <Library className="h-6 w-6 text-muted-foreground"/>
                                   </div>
                               )}
                               <div>
                                   <p className="font-medium">{r.title}</p>
                                   <p className="text-sm text-muted-foreground capitalize">{r.type}</p>
                               </div>
                           </div>
                       </CommandItem>
                   ))}
               </CommandGroup>
            )}
          </CommandList>
           <div className="p-2 border-t text-xs text-muted-foreground flex items-center justify-end gap-2">
                Søk levert av Arkitekturopprøret
            </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

    