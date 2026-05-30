
'use client';

import { useState, useEffect } from "react";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Book, Video, Mic, ExternalLink, PlayCircle, X } from "lucide-react";
import { collection, getDocs, query, orderBy, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useFirestore } from "@/firebase/index";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Recommendation = {
    id: string;
    title: string;
    creator: string;
    description: string;
    imageUrl: string;
    type: 'book' | 'documentary' | 'podcast';
    aiHint: string;
    linkUrl?: string;
};

const getEmbedUrl = (url: string | undefined): string | null => {
    if (!url) return null;

    // YouTube
    const youtubeMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
    if (youtubeMatch) {
        return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // Vimeo
    const vimeoMatch = url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    
    return null;
}

export default function AnbefalingerPage() {
    const firestore = useFirestore();
    const [allRecommendations, setAllRecommendations] = useState<Recommendation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!firestore) return;
        setIsLoading(true);
        const q = query(collection(firestore, "recommendations"), orderBy("order", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const recs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recommendation));
            setAllRecommendations(recs);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching recommendations:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [firestore]);


    const recommendations = {
        books: allRecommendations.filter(r => r.type === 'book'),
        documentaries: allRecommendations.filter(r => r.type === 'documentary'),
        podcasts: allRecommendations.filter(r => r.type === 'podcast'),
    };
    
    const RecommendationCardFooter = ({ rec }: { rec: Recommendation }) => {
        if (!rec.linkUrl) return null;

        const embedUrl = getEmbedUrl(rec.linkUrl);

        if (embedUrl) {
            return (
                 <CardFooter>
                    <Button variant="secondary" className="w-full" onClick={() => setSelectedVideoUrl(embedUrl)}>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Se video
                    </Button>
                </CardFooter>
            )
        }

        return (
            <CardFooter>
                <Button asChild variant="secondary" className="w-full">
                    <Link href={rec.linkUrl} target="_blank" rel="noopener noreferrer">
                        Se mer <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardFooter>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col min-h-screen">
                <Header />
                 <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
                <Footer />
            </div>
        )
    }

    return (
        <>
            <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">
                    <section className="bg-muted py-20 md:py-32">
                        <div className="container text-center">
                            <h1 className="text-5xl md:text-7xl font-bold font-headline">Anbefalinger</h1>
                            <p className="mt-4 text-lg max-w-3xl mx-auto text-muted-foreground">
                                Et utvalg av bøker, filmer og podcaster som har formet vår tenkning om arkitektur og byutvikling.
                            </p>
                        </div>
                    </section>
                    
                    {recommendations.books.length > 0 && (
                        <section id="books" className="py-16 md:py-24">
                            <div className="container">
                                <div className="text-left mb-12">
                                    <h2 className="text-3xl font-headline font-bold md:text-4xl flex items-center gap-3">
                                        <Book className="w-8 h-8"/> Bøker
                                    </h2>
                                    <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
                                        Grunnleggende tekster for å forstå byer og arkitekturens rolle.
                                    </p>
                                </div>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {recommendations.books.map((book) => (
                                        <Card key={book.id} className="flex flex-col">
                                            <CardHeader>
                                                <div className="relative aspect-[2/3] mb-4">
                                                    <Image src={book.imageUrl} alt={book.title} fill className="rounded-lg object-cover" data-ai-hint={book.aiHint} unoptimized/>
                                                </div>
                                                <CardTitle className="font-headline">{book.title}</CardTitle>
                                                <CardDescription>{book.creator}</CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex-grow">
                                                <p className="text-sm text-muted-foreground">{book.description}</p>
                                            </CardContent>
                                            <RecommendationCardFooter rec={book} />
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {recommendations.documentaries.length > 0 && (
                        <section id="documentaries" className="bg-muted py-16 md:py-24">
                            <div className="container">
                                <div className="text-left mb-12">
                                    <h2 className="text-3xl font-headline font-bold md:text-4xl flex items-center gap-3">
                                        <Video className="w-8 h-8"/> Dokumentarer & Videoer
                                    </h2>
                                    <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
                                        Visuelle dypdykk i byplanlegging, estetikk og arkitekturens påvirkning.
                                    </p>
                                </div>
                                <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-8">
                                    {recommendations.documentaries.map((doc) => (
                                        <Card key={doc.id} className="flex flex-col">
                                            <div className="md:w-full">
                                                <div className="relative aspect-video h-full">
                                                    <Image src={doc.imageUrl} alt={doc.title} fill className="rounded-t-lg object-cover" data-ai-hint={doc.aiHint} unoptimized />
                                                </div>
                                            </div>
                                            <div className="md:w-full flex flex-col flex-grow">
                                                <CardHeader>
                                                    <CardTitle className="font-headline">{doc.title}</CardTitle>
                                                    <CardDescription>{doc.creator}</CardDescription>
                                                </CardHeader>
                                                <CardContent className="flex-grow">
                                                    <p className="text-sm text-muted-foreground">{doc.description}</p>
                                                </CardContent>
                                                <RecommendationCardFooter rec={doc} />
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}
                    
                    {recommendations.podcasts.length > 0 && (
                        <section id="podcasts" className="py-16 md:py-24">
                            <div className="container">
                                <div className="text-left mb-12">
                                    <h2 className="text-3xl font-headline font-bold md:text-4xl flex items-center gap-3">
                                        <Mic className="w-8 h-8"/> Podcaster
                                    </h2>
                                    <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
                                        Lytt og lær mens du er på farten.
                                    </p>
                                </div>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {recommendations.podcasts.map((podcast) => (
                                        <Card key={podcast.id} className="flex flex-col text-center items-center">
                                            <CardHeader>
                                                <div className="relative w-32 h-32 mb-4 aspect-square">
                                                    <Image src={podcast.imageUrl} alt={podcast.title} fill className="rounded-lg object-cover" data-ai-hint={podcast.aiHint} unoptimized/>
                                                </div>
                                                <CardTitle className="font-headline">{podcast.title}</CardTitle>
                                                <CardDescription>{podcast.creator}</CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex-grow">
                                                <p className="text-sm text-muted-foreground">{podcast.description}</p>
                                            </CardContent>
                                            <RecommendationCardFooter rec={podcast} />
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                </main>
                <Footer />
            </div>

            <Dialog open={!!selectedVideoUrl} onOpenChange={(open) => !open && setSelectedVideoUrl(null)}>
                <DialogContent className="max-w-4xl p-0 border-0">
                     <DialogTitle className="sr-only">Videoavspiller</DialogTitle>
                    {selectedVideoUrl && (
                         <div className="aspect-video">
                            <iframe 
                                src={selectedVideoUrl} 
                                title="Embedded video player"
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                                className="w-full h-full rounded-lg"
                            ></iframe>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
