
"use client";

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase/index";
import { collection } from "firebase/firestore";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { Loader2 } from "lucide-react";
import type { Building } from '@/types/building';

// Dynamically import MapComponent to ensure it's client-side only
const MapComponent = dynamic(() => import('@/components/site/map-component'), { 
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
});

export default function MapPage() {
    const firestore = useFirestore();
    const projectsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'projects');
    }, [firestore]);

    const { data: buildingsData, isLoading } = useCollection<Building>(projectsQuery);

    const buildings = (buildingsData || []).filter(building => building.latitude && building.longitude);
    
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 flex flex-col">
                 <section className="bg-muted py-12">
                    <div className="container text-center">
                        <h1 className="text-5xl md:text-7xl font-bold font-headline">Kart over Bygninger</h1>
                        <p className="mt-4 text-lg max-w-3xl mx-auto text-muted-foreground">
                           Utforsk databasen visuelt på kartet over Bergen.
                        </p>
                    </div>
                </section>
                <div className="flex-grow relative" style={{ height: "70vh" }}>
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        </div>
                    ) : (
                        <MapComponent buildings={buildings} />
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
