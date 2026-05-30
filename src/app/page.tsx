
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Facebook, Instagram, Twitter } from "lucide-react";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { 
  DEFAULT_HERO_IMAGE, 
  DEFAULT_HERO_HEADING, 
  DEFAULT_HERO_SUBHEADING, 
  DEFAULT_LOGO, 
  DEFAULT_ORG_NAME,
  DEFAULT_SOCIAL_FACEBOOK,
  DEFAULT_SOCIAL_INSTAGRAM,
  DEFAULT_SOCIAL_TWITTER
} from "@/lib/constants";
import { db } from "@/lib/firebase/server";
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import { ContactForm } from "@/components/site/contact-form";
import { cn } from "@/lib/utils";
import type { Building } from '@/types/building';
import type { VoteOptionValue, ProjectVotesDoc } from "@/components/site/building-vote-client";




type Article = {
  id: string;
  title: string;
  content: string;
  authors: string[];
  date: Timestamp;
  type: string;
  status: 'Kladd' | 'Publisert';
  imageUrl?: string;
  mediaHouse?: string;
  mediaLogoUrl?: string;
  originalArticleUrl?: string;
  mediaType?: 'Artikkel' | 'Video';
};

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


async function getSiteSettings() {
  try {
    const docRef = doc(db, "settings", "siteConfig");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        logoUrl: data.logoUrl || DEFAULT_LOGO,
        orgName: data.orgName || DEFAULT_ORG_NAME,
        heroUrl: data.heroUrl || DEFAULT_HERO_IMAGE,
        heroHeading: data.heroHeading || DEFAULT_HERO_HEADING,
        heroSubheading: data.heroSubheading || DEFAULT_HERO_SUBHEADING,
        socialLinks: data.socialLinks || {
            facebook: DEFAULT_SOCIAL_FACEBOOK,
            instagram: DEFAULT_SOCIAL_INSTAGRAM,
            twitter: DEFAULT_SOCIAL_TWITTER
        }
      };
    }
  } catch (error) {
    console.error("Error fetching site settings:", error);
  }
  
  return {
    logoUrl: DEFAULT_LOGO,
    orgName: DEFAULT_ORG_NAME,
    heroUrl: DEFAULT_HERO_IMAGE,
    heroHeading: DEFAULT_HERO_HEADING,
    heroSubheading: DEFAULT_HERO_SUBHEADING,
    socialLinks: {
        facebook: DEFAULT_SOCIAL_FACEBOOK,
        instagram: DEFAULT_SOCIAL_INSTAGRAM,
        twitter: DEFAULT_SOCIAL_TWITTER
    }
  };
}

async function getNews(): Promise<Article[]> {
  try {
    const newsQuery = query(
      collection(db, "news"),
      where("status", "==", "Publisert"),
      orderBy("date", "desc"),
      limit(3) 
    );
    const querySnapshot = await getDocs(newsQuery);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            authors: data.authors || (data.author ? [data.author] : [])
        } as Article
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
}

async function getBuildings(): Promise<Building[]> {
    try {
        const buildingsQuery = query(collection(db, "projects"), orderBy("name"), limit(3));
        const buildingsSnapshot = await getDocs(buildingsQuery);
        const buildings = buildingsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Building));
        
        // Fetch all votes documents
        const votesSnapshot = await getDocs(collection(db, "architecturalProjectVotes"));
        const votesMap = new Map<string, ProjectVotesDoc>();
        votesSnapshot.forEach(doc => {
            votesMap.set(doc.id, doc.data() as ProjectVotesDoc);
        });
        
        // Map votes to buildings
        const buildingsWithCategories = buildings.map(building => {
            const buildingVotes = votesMap.get(building.id);
            const category = getCategoryFromVotes(buildingVotes);
            return { ...building, category };
        });

        return buildingsWithCategories;
    } catch (error) {
        console.error("Error fetching buildings:", error);
        return [];
    }
}

export default async function Home() {
  const settings = await getSiteSettings();
  const newsArticles = await getNews();
  const buildings = await getBuildings();

  const NewsArticleCard = ({ article, index }: { article: Article; index: number; }) => {
    const isDirectLink = article.type === 'I media' && !article.content?.trim() && article.originalArticleUrl;
    const href = isDirectLink ? article.originalArticleUrl! : `/news/${article.id}`;
    const linkText = article.mediaType === 'Video' ? `Se hos ${article.mediaHouse}` : 'Les mer';

    return (
        <Card className={cn("flex flex-col h-full overflow-hidden transition-all duration-300 border-border/80 hover:shadow-md hover:-translate-y-1 motion-safe:animate-fade-in-up opacity-0")} style={{ animationDelay: `${index * 150}ms` }}>
        
        <Link href={href} target={isDirectLink ? "_blank" : "_self"} rel={isDirectLink ? "noopener noreferrer" : ""} className="block aspect-video relative overflow-hidden group border-b border-border/40">
            {article.imageUrl && (
                <Image 
                    src={article.imageUrl}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized
                />
            )}
             {isDirectLink && article.mediaLogoUrl && (
                <div className="absolute top-4 left-4 z-10 bg-white p-1 rounded shadow-sm">
                    <Image 
                        src={article.mediaLogoUrl} 
                        alt={`${article.mediaHouse} logo`} 
                        width={80} 
                        height={20}
                        className="object-contain"
                        unoptimized
                    />
                </div>
             )}
        </Link>

        <CardHeader className="p-5">
          <div className="flex items-center gap-2 text-xs">
            {article.type && <Badge variant="secondary" className="px-2 py-0.5 rounded-sm bg-secondary text-secondary-foreground text-[10px] tracking-wide uppercase">{article.type}</Badge>}
            <CardDescription className="text-muted-foreground/80 font-mono text-[11px]">{format(article.date.toDate(), 'dd. MMMM yyyy', { locale: nb })}</CardDescription>
          </div>
          <CardTitle className="font-headline pt-2 text-xl font-bold leading-tight tracking-tight text-foreground group-hover:text-primary transition-colors">{article.title}</CardTitle>
        </CardHeader>

        {!isDirectLink && (
           <CardContent className="px-5 pb-4 pt-0 flex-grow prose dark:prose-invert prose-sm max-h-32 overflow-hidden relative">
                <div className="text-muted-foreground/90 leading-relaxed font-body text-sm line-clamp-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>
                        {article.content}
                    </ReactMarkdown>
                </div>
                <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
           </CardContent>
        )}
       
        <CardFooter className="px-5 pb-5 pt-0 mt-auto">
          <Button variant="link" asChild className="p-0 h-auto font-body text-primary font-bold hover:text-primary/85 flex items-center gap-1.5 group-hover/btn:underline">
            <Link href={href} target={isDirectLink ? "_blank" : "_self"} rel={isDirectLink ? "noopener noreferrer" : ""}>
                {isDirectLink ? (
                    <div className="flex items-center gap-1">
                       <span>{linkText}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                ) : 'Les mer →'}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const BuildingCard = ({ building, index }: { building: Building; index: number }) => {
    const imageUrl = building.imageUrls?.[0];
    return (
      <Link key={building.id} href={`/buildings/${building.slug || building.id}`} className="group block motion-safe:animate-fade-in-up opacity-0" style={{ animationDelay: `${index * 150}ms` }}>
        <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 border-border/80 hover:shadow-md hover:-translate-y-1">
            {imageUrl && (
                <div className="block aspect-video relative overflow-hidden border-b border-border/40">
                    <Image 
                        src={imageUrl}
                        alt={building.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        unoptimized
                    />
                </div>
            )}
            <CardHeader className="p-5">
                <CardTitle className="font-headline text-lg font-bold leading-tight tracking-tight text-foreground group-hover:text-primary transition-colors">{building.name}</CardTitle>
                <CardDescription className="text-muted-foreground/80 font-body text-sm pt-1">{building.address}</CardDescription>
            </CardHeader>
             <CardContent className="px-5 pb-5 pt-0">
                {building.category && (
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
                )}
            </CardContent>
        </Card>
      </Link>
    );
  };


  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <section className="relative w-full h-[60vh] md:h-[80vh] flex items-center justify-center text-center text-white">
          <div 
            className="absolute inset-0 -z-20 bg-cover bg-center"
            style={{ backgroundImage: `url(${settings.heroUrl})` }}
            data-ai-hint="architecture bergen"
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 -z-10" />
          <div className="relative z-10 p-4 flex flex-col items-center">
            <h1 className="text-4xl md:text-7xl font-bold font-headline drop-shadow-lg motion-safe:animate-fade-in-down opacity-0">{settings.heroHeading}</h1>
            <p className="mt-4 max-w-2xl text-lg md:text-xl font-body drop-shadow-md motion-safe:animate-fade-in-down motion-safe:animation-delay-300 opacity-0">{settings.heroSubheading}</p>
            
            <div className="flex items-center gap-2 mt-8">
              {settings.socialLinks.facebook && (
                  <Button variant="ghost" size="icon" asChild className="text-white hover:text-white/80 hover:bg-white/10 motion-safe:animate-fade-in-up motion-safe:animation-delay-400 opacity-0">
                      <Link href={settings.socialLinks.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                          <Facebook className="h-6 w-6" />
                      </Link>
                  </Button>
              )}
               {settings.socialLinks.instagram && (
                  <Button variant="ghost" size="icon" asChild className="text-white hover:text-white/80 hover:bg-white/10 motion-safe:animate-fade-in-up motion-safe:animation-delay-500 opacity-0">
                      <Link href={settings.socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                          <Instagram className="h-6 w-6" />
                      </Link>
                  </Button>
              )}
               {settings.socialLinks.twitter && (
                  <Button variant="ghost" size="icon" asChild className="text-white hover:text-white/80 hover:bg-white/10 motion-safe:animate-fade-in-up motion-safe:animation-delay-600 opacity-0">
                      <Link href={settings.socialLinks.twitter} target="_blank" rel="noopener noreferrer" aria-label="X/Twitter">
                          <Twitter className="h-6 w-6" />
                      </Link>
                  </Button>
              )}
            </div>

            <Button size="lg" className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90 motion-safe:animate-fade-in-up motion-safe:animation-delay-700 opacity-0" asChild>
              <Link href="/bli-medlem">Bli Medlem</Link>
            </Button>
          </div>
        </section>

        <section id="news" className="container py-16 md:py-24">
          <div className="text-center mb-16 motion-safe:animate-fade-in-up opacity-0">
              <h2 className="text-3xl md:text-4xl editorial-heading-accent">Siste Nytt</h2>
              <p className="mt-4 max-w-2xl mx-auto text-lg editorial-deck">Følg med på vårt arbeid og de siste hendelsene i bybildet.</p>
          </div>
          <div className="editorial-grid grid-cols-1 md:grid-cols-3">
            {newsArticles.map((article, i) => (
              <NewsArticleCard 
                key={article.id} 
                article={article} 
                index={i} 
              />
            ))}
          </div>
            <div className="text-center mt-14 motion-safe:animate-fade-in-up opacity-0">
                <Button asChild size="lg" className="rounded-sm tracking-wide font-headline">
                    <Link href="/news">Les alle nyheter</Link>
                </Button>
            </div>
        </section>
        
        <section id="buildings" className="bg-muted py-16 md:py-24 border-y border-border/40">
          <div className="container">
            <div className="text-center mb-16 motion-safe:animate-fade-in-up opacity-0">
              <h2 className="text-3xl md:text-4xl editorial-heading-accent">Utvalgte Bygninger</h2>
              <p className="mt-4 max-w-2xl mx-auto text-lg editorial-deck">Et lite utvalg fra vår bygningsdatabase, hvor du kan stemme på hva du synes.</p>
            </div>
            <div className="editorial-grid grid-cols-1 md:grid-cols-3">
              {buildings.map((building, i) => (
                <BuildingCard key={building.id} building={building} index={i} />
              ))}
            </div>
             <div className="text-center mt-14 motion-safe:animate-fade-in-up opacity-0">
                <Button asChild size="lg" className="rounded-sm tracking-wide font-headline">
                    <Link href="/buildings">Se hele databasen</Link>
                </Button>
            </div>
          </div>
        </section>

        <section id="contact" className="py-16 md:py-24">
          <div className="container motion-safe:animate-fade-in-up opacity-0">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-headline font-bold md:text-4xl">Engasjer deg</h2>
                <p className="mt-4 text-lg text-muted-foreground">Har du spørsmål, innspill, eller ønsker du å bidra? Ta kontakt med oss!</p>
              </div>
              <ContactForm />
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
