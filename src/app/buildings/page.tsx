

"use client";

import { useState, useMemo } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase/index";
import { collection, orderBy, query, where } from "firebase/firestore";
import Image from "next/image";
import { Header } from "@/components/site/header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/site/footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { VoteOptionValue, ProjectVotesDoc } from "@/components/site/building-vote-client";
import type { Building } from '@/types/building';


type BuildingWithCategory = Building & {
    category: string;
}

const categoryLabels: { [key: string]: string } = {
    '0': 'Usedvanlig Stygt',
    '1': 'Stygt',
    '2': 'OK Minus',
    '3': 'OK',
    '4': 'OK Pluss',
    '5': 'Vakkert',
    '6': 'Usedvanlig Vakkert',
};


const getCategoryFromVotes = (votesDoc: ProjectVotesDoc | undefined): string => {
    if (!votesDoc || !votesDoc.votes) {
        return "Ingen stemmer";
    }
    const voteList = Object.values(votesDoc.votes);
    if (voteList.length === 0) {
        return "Ingen stemmer";
    }

    const totalScore = voteList.reduce((sum, vote) => sum + vote.voteValue, 0);
    const averageScore = Math.round(totalScore / voteList.length);
    
    return categoryLabels[String(averageScore)] || "Ingen stemmer";
};


const verneklasseMap: Record<string, string> = {
    fredet: "Fredet",
    verneverdig: "Verneverdig",
    bevaringsverdig: "Bevaringsverdig",
    automatisk_fredet: "Automatisk fredet",
    ikke_vurdert: "Ikke vurdert / ukjent",
};

export default function BuildingsPage() {
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [styleFilter, setStyleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [verneklasseFilter, setVerneklasseFilter] = useState("all");
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const buildingsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // Only fetch buildings that are not drafts
        return query(
            collection(firestore, "projects"), 
            orderBy("name")
        );
    }, [firestore]);

    const votesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, "architecturalProjectVotes");
    }, [firestore]);

    const { data: buildingsData, isLoading: isLoadingBuildings } = useCollection<Building>(buildingsQuery);
    const { data: votesData, isLoading: isLoadingVotes } = useCollection<ProjectVotesDoc>(votesQuery);
    
    const isLoading = isLoadingBuildings || isLoadingVotes;
    
    const buildingsWithCategories = useMemo(() => {
        if (!buildingsData) return [];
        const votesMap = votesData ? new Map(votesData.map(voteDoc => [voteDoc.id, voteDoc])) : new Map();
        
        return buildingsData
            .filter(building => building.status !== "Kladd")
            .map(building => {
                const buildingVotes = votesMap.get(building.id);
                const category = getCategoryFromVotes(buildingVotes);
                return { ...building, category };
            });
    }, [buildingsData, votesData]);


    const filteredBuildings = useMemo(() => {
        return buildingsWithCategories.filter(building => {
            const searchTermMatch = searchTerm === "" ||
                building.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (building.address && building.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (building.arkitekt && building.arkitekt.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (building.owner && building.owner.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const categoryMatch = categoryFilter === "all" || building.category === categoryFilter;
            const styleMatch = styleFilter === "all" || building.style === styleFilter;
            const statusMatch = statusFilter === "all" || building.status === statusFilter;
            const verneklasseMatch = verneklasseFilter === "all" || (building.verneklasse || 'ikke_vurdert') === verneklasseFilter;

            return searchTermMatch && categoryMatch && styleMatch && statusMatch && verneklasseMatch;
        });
    }, [buildingsWithCategories, searchTerm, categoryFilter, styleFilter, statusFilter, verneklasseFilter]);

    const uniqueValues = (key: keyof BuildingWithCategory) => {
        const values = buildingsWithCategories.map(b => b[key]).filter(Boolean) as string[];
        return [...new Set(values)].sort();
    };

    const categories = Object.values(categoryLabels);
    const styles = uniqueValues("style");
    const statuses = uniqueValues("status");
    const verneklasser = Object.entries(verneklasseMap);

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">
                <section className="bg-muted pt-20 md:pt-32 pb-12 border-b border-border/30">
                    <div className="container text-center">
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline editorial-heading-accent">Bygninger</h1>
                        <p className="mt-6 text-lg max-w-3xl mx-auto editorial-deck">
                           Utforsk databasen over bygninger i Bergen, og se hva folk mener om dem.
                        </p>
                        <Button asChild className="mt-8 rounded-sm tracking-wide font-headline">
                            <Link href="/tips-oss">Tips oss om en bygning</Link>
                        </Button>
                    </div>
                </section>
                
                <section className="py-8 md:py-12">
                    <div className="container">
                        <div className="mb-12 p-6 border rounded-lg bg-card space-y-4">
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="relative flex-grow">
                                    <Label htmlFor="search" className="sr-only">Søk</Label>
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="search"
                                        placeholder="Søk etter navn, adresse, arkitekt, eier..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <Button variant="outline" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
                                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                                    {showAdvancedFilters ? 'Skjul filtre' : 'Flere filtre'}
                                </Button>
                            </div>

                            {showAdvancedFilters && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                                    <div>
                                        <Label>Kategori</Label>
                                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Alle kategorier</SelectItem>
                                                {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Stil</Label>
                                        <Select value={styleFilter} onValueChange={setStyleFilter}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Alle stiler</SelectItem>
                                                {styles.map(style => <SelectItem key={style} value={style}>{style}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Status</Label>
                                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Alle statuser</SelectItem>
                                                {statuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                     <div>
                                        <Label>Verneklasse</Label>
                                        <Select value={verneklasseFilter} onValueChange={setVerneklasseFilter}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Alle verneklasser</SelectItem>
                                                {verneklasser.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                        </div>

                         {isLoading ? (
                            <div className="flex justify-center items-center py-16">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                <div className="editorial-grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {filteredBuildings.map((building) => (
                                        <Link key={building.id} href={`/buildings/${building.slug || building.id}`} className="group block">
                                        <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 border-border/80 hover:shadow-md hover:-translate-y-1">
                                            {building.imageUrls && building.imageUrls.length > 0 && (
                                                <div className="aspect-video relative overflow-hidden border-b border-border/40">
                                                    <Image src={building.imageUrls[0]} alt={building.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized />
                                                </div>
                                            )}
                                            <CardHeader className="p-5">
                                                <CardTitle className="font-headline text-lg font-bold leading-tight tracking-tight text-foreground group-hover:text-primary transition-colors">{building.name}</CardTitle>
                                                <CardDescription className="text-muted-foreground/80 font-body text-sm pt-1">{building.address}</CardDescription>
                                            </CardHeader>
                                            <CardContent className="px-5 pb-5 pt-0 flex-grow">
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant={
                                                        building.category === "Vakkert" || building.category === "Usedvanlig Vakkert" ? "default" :
                                                        building.category === "Stygt" || building.category === "Usedvanlig Stygt" ? "destructive" :
                                                        building.category === "OK Pluss" || building.category === "OK Minus" || building.category === "OK" ? "secondary" : "outline"
                                                    }
                                                    className={cn("px-2.5 py-0.5 text-xs font-semibold rounded-sm", {
                                                        'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300/50': building.category === "Vakkert" || building.category === "Usedvanlig Vakkert",
                                                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-300/50': building.category === "OK Pluss" || building.category === "OK Minus" || building.category === "OK"
                                                    })}>
                                                        {building.category}
                                                    </Badge>
                                                    {(building.style || building.subStyle) && (
                                                        <Badge variant="outline" className="rounded-sm border-border text-muted-foreground/90 font-medium">
                                                            {building.style}
                                                            {building.subStyle && ` - ${building.subStyle}`}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </CardContent>
                                            {(building.constructionYear || building.completionYear) && (
                                                <CardFooter className="px-5 pb-5 pt-0 flex-col items-start text-xs font-mono text-muted-foreground border-t border-border/20 pt-4">
                                                    {building.constructionYear && <p>Byggeår: {building.constructionYear}</p>}
                                                    {building.completionYear && <p>Ferdigstilt: {building.completionYear}</p>}
                                                </CardFooter>
                                            )}
                                        </Card>
                                        </Link>
                                    ))}
                                </div>
                                {filteredBuildings.length === 0 && (
                                    <div className="text-center py-16 text-muted-foreground">
                                        <p>{buildingsWithCategories.length > 0 ? "Ingen bygninger matcher dine filtervalg." : "Ingen bygninger er lagt til i databasen enda."}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
