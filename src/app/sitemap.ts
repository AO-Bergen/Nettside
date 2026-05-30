import { MetadataRoute } from 'next'
import { db } from '@/lib/firebase/server';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

export const dynamic = 'force-static';

const BASE_URL = 'https://ao-bergen.no/';

type Article = {
  id: string;
  date: { toDate: () => Date };
};

type Event = {
  slug: string;
  id: string;
  eventDate: { toDate: () => Date };
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  
  const staticRoutes = [
    '',
    '/about',
    '/bli-medlem',
    '/events',
    '/news',
    '/presse',
    '/tips-oss',
    '/buildings',
    '/buildings/map',
    '/anbefalinger',
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date().toISOString(),
  }));

  try {
    // Fetch news articles
    const newsQuery = query(
      collection(db, "news"),
      where("status", "==", "Publisert")
    );
    const newsSnapshot = await getDocs(newsQuery);
    const newsRoutes = newsSnapshot.docs.map((doc) => {
      const data = doc.data() as Article;
      return {
        url: `${BASE_URL}news/${doc.id}`,
        lastModified: data.date.toDate().toISOString(),
      };
    });

    // Fetch events
    const eventsQuery = query(collection(db, "events"));
    const eventsSnapshot = await getDocs(eventsQuery);
    const eventRoutes = eventsSnapshot.docs.map((doc) => {
      const data = doc.data() as Event;
      const slug = data.slug || doc.id;
      return {
        url: `${BASE_URL}events/${slug}`,
        lastModified: data.eventDate.toDate().toISOString(),
      };
    });
    
    return [...staticRoutes, ...newsRoutes, ...eventRoutes];

  } catch (error) {
    console.error("Error generating sitemap:", error);
    // Return only static routes on error
    return staticRoutes;
  }
}
