
import { db } from "@/lib/firebase/server";
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, Timestamp } from "firebase/firestore";
import { Header } from "@/components/site/header";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { 
  DEFAULT_LOGO, 
  DEFAULT_ORG_NAME 
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/site/footer";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { Metadata, ResolvingMetadata } from "next";
import { EditButton } from "@/components/site/edit-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Article = {
  id: string;
  title: string;
  content: string;
  authors: string[];
  date: Timestamp;
  type: string;
  status: 'Kladd' | 'Publisert';
  imageUrl?: string;
  imageAttribution?: string;
  mediaHouse?: string;
  mediaLogoUrl?: string;
  originalArticleUrl?: string;
  mediaType?: 'Artikkel' | 'Video';
};

const parseCiteWeb = (citeString: string) => {
    if (!citeString || !citeString.trim().startsWith('{{cite web')) {
        return null;
    }
    const content = citeString.slice(citeString.indexOf('{{cite web') + 10, citeString.lastIndexOf('}}')).trim();
    const pairs = content.split('|').map(s => s.trim()).filter(Boolean);
    const result: Record<string, string> = {};
    pairs.forEach(pair => {
        const firstEqual = pair.indexOf('=');
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
                         <figcaption className="text-xs text-muted-foreground text-right mt-1 pr-1 cursor-help">
                             Bilde: <span className="underline">{parsed.author || parsed.publisher || 'Kilde'}</span>
                         </figcaption>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs" side="top" align="end">
                       <ul className="space-y-1 text-xs">
                            {parsed.title && <li><strong>Tittel:</strong> {parsed.title}</li>}
                            {parsed.author && <li><strong>Opphav:</strong> {parsed.author}</li>}
                            {parsed.publisher && <li><strong>Utgiver:</strong> {parsed.publisher}</li>}
                            {parsed.url && (
                                <li>
                                    <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                        Gå til kilde <ExternalLink className="h-3 w-3"/>
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
        <figcaption className="text-xs text-muted-foreground text-right mt-1 pr-1">
            Bilde: {attribution}
        </figcaption>
    );
};


async function getArticle(id: string): Promise<Article | null> {
    try {
        const docRef = doc(db, "news", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().status === 'Publisert') {
            const data = docSnap.data();
            return { 
                id: docSnap.id, 
                ...data,
                authors: data.authors || (data.author ? [data.author] : [])
            } as Article;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching article ${id}:`, error);
        return null;
    }
}

async function getRecentNews(currentArticleId: string): Promise<Article[]> {
    try {
        const newsQuery = query(
            collection(db, "news"),
            where("status", "==", "Publisert"),
            orderBy("date", "desc"),
            limit(5)
        );
        const snapshot = await getDocs(newsQuery);
        const allRecent = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Article);
        
        return allRecent
            .filter(article => article.id !== currentArticleId)
            .slice(0, 2);

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
    const newsQuery = query(
      collection(db, "news"),
      where("status", "==", "Publisert")
    );
    const querySnapshot = await getDocs(newsQuery);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
    }));
  } catch (error) {
    console.error("Error generating static params for news detail:", error);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id);
  
  if (!article) {
    return {
      title: "Artikkel ikke funnet"
    };
  }

  const description = article.content.substring(0, 160).replace(/(\r\n|\n|\r)/gm, " ").trim() + '...';

  return {
    title: article.title,
    description: description,
    authors: article.authors.map(name => ({ name: name })),
    openGraph: {
        title: article.title,
        description: description,
        type: 'article',
        publishedTime: article.date.toDate().toISOString(),
        authors: article.authors,
        images: article.imageUrl ? [
            {
                url: article.imageUrl,
                alt: article.title,
            }
        ] : [],
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const article = await getArticle(id);
    const recentArticles = await getRecentNews(id);
    const settings = await getSiteSettings();


    if (!article) {
        notFound();
    }

    const isMediaArticle = article.type === 'I media' && article.mediaHouse && article.originalArticleUrl;
    const linkText = article.mediaType === 'Video' ? `Se videoen hos ${article.mediaHouse}` : `Les originalartikkelen hos ${article.mediaHouse}`;
    
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': article.title,
        'image': article.imageUrl,
        'datePublished': article.date.toDate().toISOString(),
        'author': article.authors.map(name => ({
            '@type': 'Person',
            'name': name
        })),
        'publisher': {
            '@type': 'Organization',
            'name': settings.orgName,
            'logo': {
                '@type': 'ImageObject',
                'url': settings.logoUrl
            }
        },
        'description': article.content.substring(0, 200).replace(/(\r\n|\n|\r)/gm, " ").trim() + '...'
    };

    return (
        <div className="flex flex-col min-h-screen">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <Header />
            <main className="flex-1 py-12 md:py-20">
                <div className="container">
                    <div className="grid lg:grid-cols-4 gap-12">
                        <article className="prose dark:prose-invert max-w-none lg:col-span-3">
                            <header className="mb-8">
                                <div className="flex items-center gap-4 !mb-2">
                                     {article.type && <Badge variant="secondary">{article.type}</Badge>}
                                    <p className="text-muted-foreground !mt-0 !mb-0">
                                        {format(article.date.toDate(), 'dd. MMMM yyyy', { locale: nb })}
                                    </p>
                                </div>
                                <h1 className="!mb-2 font-headline">{article.title}</h1>
                                <p className="text-muted-foreground !mt-0">
                                    Av {article.authors.join(', ')}
                                </p>
                            </header>
                             {article.imageUrl && (
                                <figure className="relative aspect-video mb-8 not-prose">
                                    <Image
                                        src={article.imageUrl}
                                        alt={article.title}
                                        fill
                                        className="rounded-lg object-cover"
                                        unoptimized
                                        priority
                                    />
                                     <Attribution attribution={article.imageAttribution} />
                                    {isMediaArticle && article.mediaLogoUrl && (
                                        <div className="absolute top-4 left-4 z-10 bg-white p-2 rounded-lg shadow">
                                            <Image 
                                                src={article.mediaLogoUrl} 
                                                alt={`${article.mediaHouse} logo`} 
                                                width={120} 
                                                height={40}
                                                className="object-contain"
                                                unoptimized
                                            />
                                        </div>
                                    )}
                                </figure>
                            )}

                            {isMediaArticle && (
                                <Button asChild className="mb-8">
                                    <Link href={article.originalArticleUrl!} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        {linkText}
                                    </Link>
                                </Button>
                            )}

                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>{article.content}</ReactMarkdown>
                        </article>
                        <aside className="lg:col-span-1 space-y-8">
                             <div>
                                <h3 className="font-headline text-2xl mb-4 border-b pb-2">Mer å Lese</h3>
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
            <EditButton editUrl={`/dashboard/news?edit=${article.id}`} />
            <Footer />
        </div>
    );
}
