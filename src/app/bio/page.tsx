
import { getFirestore, collection, getDocs, query, orderBy, Timestamp, doc, getDoc } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { DEFAULT_LOGO, DEFAULT_ORG_NAME } from "@/lib/constants";
import { db } from "@/lib/firebase/server";
import { Button } from "@/components/ui/button";



type InstagramLink = {
  id: string;
  imageUrl: string;
  destinationUrl: string;
  createdAt: Timestamp;
};

async function getLinks(): Promise<InstagramLink[]> {
  try {
    const q = query(collection(db, "instagramLinks"), orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InstagramLink));
  } catch (error) {
    console.error("Error fetching Instagram links:", error);
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

export default async function BioPage() {
  const links = await getLinks();
  const settings = await getSiteSettings();

  const renderLink = (link: InstagramLink) => {
    // If there is no image, it's a spacer. Render an empty, non-clickable div.
    if (!link.imageUrl) {
        return <div key={link.id}></div>;
    }

    // This container enforces the 1:1 aspect ratio and contains the image
    const content = (
        <div className="relative aspect-square w-full h-full overflow-hidden">
           <Image
                src={link.imageUrl}
                alt="Instagram post link"
                fill
                className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                unoptimized
            />
        </div>
    );

    // If there is a destination URL, wrap the content in a link
    if (link.destinationUrl) {
        return (
            <Link
                key={link.id}
                href={link.destinationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block overflow-hidden rounded-md transition-transform duration-200 transform hover:scale-105 hover:shadow-lg"
            >
                {content}
            </Link>
        );
    }

    // Otherwise, just render the non-clickable image container
    return (
        <div key={link.id} className="relative block overflow-hidden rounded-md">
            {content}
        </div>
    )
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-900 flex flex-col items-center min-h-screen">
        <header className="w-full max-w-4xl p-4 sm:p-6 lg:p-8 flex justify-center">
            <Button asChild variant="outline">
                <Link href="/">
                    Besøk Nettsiden
                </Link>
            </Button>
        </header>
        <main className="w-full max-w-4xl p-4 sm:p-6 lg:p-8 pt-0">
            <header className="flex flex-col items-center text-center my-8">
                <Image
                    src={settings.logoUrl}
                    alt={`${settings.orgName} Logo`}
                    width={96}
                    height={96}
                    className="rounded-full mb-4"
                    unoptimized
                />
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">@ao_bergen</h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">Klikk på et bilde for å utforske!</p>
            </header>

            <div className="grid grid-cols-3 gap-1">
                {links.map(renderLink)}
            </div>
            
             {links.length === 0 && (
                <div className="text-center py-16 text-muted-foreground col-span-3">
                    <p>Ingen lenker er tilgjengelige for øyeblikket.</p>
                </div>
            )}
            <footer className="text-center mt-16 text-sm text-muted-foreground">
                <Link href="/" className="hover:underline">
                    Tilbake til {settings.orgName}
                </Link>
            </footer>
        </main>
    </div>
  );
}
