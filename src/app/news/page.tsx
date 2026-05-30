

import { db } from "@/lib/firebase/server";
import { collection, getDocs, query, where, orderBy, Timestamp, doc, getDoc } from "firebase/firestore";
import { Header } from "@/components/site/header";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import { 
  DEFAULT_LOGO, 
  DEFAULT_ORG_NAME 
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/site/footer";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { Metadata } from "next";



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

async function getPublishedNews(): Promise<Article[]> {
    try {
        const newsQuery = query(
            collection(db, "news"), 
            where("status", "==", "Publisert"), 
            orderBy("date", "desc")
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

export async function generateMetadata(): Promise<Metadata> {
    const settings = await getSiteSettings();
    const title = `Nyhetsarkiv | ${settings.orgName}`;
    const description = `Siste nytt, pressemeldinger, leserinnlegg og medieomtaler fra ${settings.orgName}.`;
  
    return {
      title: title,
      description: description,
      openGraph: {
        title: title,
        description: description,
        type: 'website',
      },
    };
  }

export default async function NewsHubPage() {
    const articles = await getPublishedNews();
    const settings = await getSiteSettings();

    if (!articles.length) {
        return (
             <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 py-12 md:py-20">
                     <div className="container">
                        <header className="mb-12 text-center">
                            <h1 className="text-5xl md:text-7xl font-bold font-headline">Nyhetsarkiv</h1>
                            <p className="mt-4 text-lg text-muted-foreground">Siste nytt fra {settings.orgName}</p>
                        </header>
                         <div className="text-center py-16 text-muted-foreground">
                            <p>Ingen publiserte nyheter funnet.</p>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        )
    }

    const featuredArticle = articles[0];
    const otherArticles = articles.slice(1);
    
    const isDirectLink = (article: Article) => 
        article.type === 'I media' && 
        !article.content?.trim() && 
        article.originalArticleUrl;

    const FeaturedArticleCard = ({ article }: { article: Article }) => {
        const useExternalLink = isDirectLink(article);
        const href = useExternalLink ? article.originalArticleUrl! : `/news/${article.id}`;
        const linkText = article.mediaType === 'Video' ? `Se videoen hos ${article.mediaHouse}` : `Les saken hos ${article.mediaHouse}`;

        return (
            <Link href={href} target={useExternalLink ? "_blank" : "_self"} rel={useExternalLink ? "noopener noreferrer" : ""} className="group block">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div className="overflow-hidden rounded-lg aspect-video relative">
                        <Image
                            src={article.imageUrl || `https://placehold.co/800x600.png`}
                            alt={article.title}
                            fill
                            className="object-cover w-full h-full transition-transform duration-300 ease-in-out group-hover:scale-105"
                            data-ai-hint="news article"
                            unoptimized
                        />
                         {useExternalLink && article.mediaLogoUrl && (
                            <div className="absolute top-4 left-4 z-10 bg-white p-2 rounded-md shadow">
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
                    </div>
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            {article.type && <Badge variant="secondary">{article.type}</Badge>}
                            <p className="text-sm text-muted-foreground">{format(article.date.toDate(), 'dd. MMMM yyyy', { locale: nb })}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <h2 className="text-3xl md:text-4xl font-headline font-bold mb-4 group-hover:text-primary transition-colors">{article.title}</h2>
                        </div>
                        
                        {useExternalLink ? (
                             <div className="text-primary font-semibold flex items-center gap-2">
                                {linkText} <ExternalLink className="w-4 h-4" />
                            </div>
                        ) : (
                           <div className="prose dark:prose-invert max-w-none line-clamp-3">
                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>
                                    {article.content}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                </div>
            </Link>
        )
    }

     const OtherArticleCard = ({ article }: { article: Article }) => {
        const useExternalLink = isDirectLink(article);
        const href = useExternalLink ? article.originalArticleUrl! : `/news/${article.id}`;
        const linkText = article.mediaType === 'Video' ? `Se hos ${article.mediaHouse}` : `Les hos ${article.mediaHouse}`;
        
        return (
            <Link href={href} key={article.id} target={useExternalLink ? "_blank" : "_self"} rel={useExternalLink ? "noopener noreferrer" : ""} className="group block">
                <div className="flex flex-col h-full">
                    <div className="overflow-hidden rounded-lg mb-4 aspect-video relative">
                            <Image
                            src={article.imageUrl || `https://placehold.co/600x400.png`}
                            alt={article.title}
                            fill
                            className="object-cover w-full h-full transition-transform duration-300 ease-in-out group-hover:scale-105"
                            data-ai-hint="article thumbnail"
                            unoptimized
                        />
                        {useExternalLink && article.mediaLogoUrl && (
                             <div className="absolute top-4 left-4 z-10 bg-white p-1 rounded-md shadow">
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
                    </div>
                    <div className="flex items-center gap-4 mb-1">
                        {article.type && <Badge variant="secondary">{article.type}</Badge>}
                        <p className="text-sm text-muted-foreground">{format(article.date.toDate(), 'dd. MMMM yyyy', { locale: nb })}</p>
                    </div>
                    <h3 className="text-xl font-headline font-bold mb-2 group-hover:text-primary transition-colors">{article.title}</h3>
                    {useExternalLink && (
                        <div className="text-primary font-semibold flex items-center gap-2 mt-auto text-sm">
                           <span>{linkText}</span>
                           <ExternalLink className="w-4 h-4" />
                        </div>
                    )}
                </div>
            </Link>
        )
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 py-12 md:py-20">
                <div className="container">
                    <header className="mb-16 text-center">
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline editorial-heading-accent">Nyhetsarkiv</h1>
                        <p className="mt-6 text-lg max-w-2xl mx-auto editorial-deck">Siste nytt fra {settings.orgName}</p>
                    </header>

                    {featuredArticle && (
                        <section className="mb-20 border-b border-border/40 pb-16">
                           <FeaturedArticleCard article={featuredArticle} />
                        </section>
                    )}

                    {otherArticles.length > 0 && (
                        <section className="mb-12">
                            <div className="editorial-grid sm:grid-cols-2 lg:grid-cols-3">
                                {otherArticles.map((article) => (
                                    <OtherArticleCard key={article.id} article={article} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}
