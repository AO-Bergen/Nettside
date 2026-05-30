
import { BuildingPageClient } from './client';
import { db } from '@/lib/firebase/server';
import { doc, getDoc, query, collection, where, limit, getDocs } from 'firebase/firestore';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Building } from '@/types/building';

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getBuilding(identifier: string): Promise<Building | null> {
    let buildingDoc: any = null;

    // Try finding by slug first
    const q = query(collection(db, "projects"), where("slug", "==", identifier), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        buildingDoc = querySnapshot.docs[0];
    } else {
        // Fallback to ID if not found by slug
        try {
            const docRef = doc(db, "projects", identifier);
            const docSnapById = await getDoc(docRef);
            if (docSnapById.exists()) {
                buildingDoc = docSnapById;
            }
        } catch (error) {
            // Invalid ID format, will be handled by returning null
        }
    }

    if (!buildingDoc) return null;
    return { id: buildingDoc.id, ...buildingDoc.data() } as Building;
}

export async function generateStaticParams() {
  try {
    const querySnapshot = await getDocs(collection(db, "projects"));
    const params: { id: string }[] = [];
    querySnapshot.forEach(doc => {
      params.push({ id: doc.id });
      const data = doc.data();
      if (data.slug) {
        params.push({ id: data.slug });
      }
    });
    return params;
  } catch (error) {
    console.error("Error generating static params for buildings:", error);
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const building = await getBuilding(id);

    if (!building) {
        return {
            title: "Bygning ikke funnet",
        };
    }
    
    const description = building.description 
      ? building.description.substring(0, 160).replace(/(\r\n|\n|\r)/gm," ").trim() + '...'
      : `Detaljer, bilder og diskusjon om ${building.name} i Bergen.`;

    return {
        title: building.name,
        description,
        openGraph: {
            title: building.name,
            description,
            images: building.imageUrls?.[0] ? [{ url: building.imageUrls[0] }] : [],
        },
    };
}


export default async function BuildingPage({ params }: PageProps) {
  const { id } = await params;
  return <BuildingPageClient id={id} />;
}
