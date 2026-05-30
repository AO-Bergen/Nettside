
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { Header } from "@/components/site/header";
import Image from "next/image";
import Link from "next/link";
import { 
  DEFAULT_LOGO, 
  DEFAULT_ORG_NAME 
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Footer } from "@/components/site/footer";
import { Metadata } from "next";
import { db } from "@/lib/firebase/server";


type Member = { 
  id: string; 
  name: string; 
  role: string; 
  image: string; 
};

const getInitials = (name: string) => {
  if (!name) return "";
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

async function getMembers(): Promise<Member[]> {
    try {
        const membersQuery = query(collection(db, "members"), orderBy("order", "asc"));
        const querySnapshot = await getDocs(membersQuery);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                role: data.role,
                image: data.image || '',
            } as Member;
        });
    } catch (error) {
        console.error("Error fetching members:", error);
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
    const title = `Om Oss | ${settings.orgName}`;
    const description = `Lær mer om vår bevegelse, vår visjon for Bergen, og menneskene som driver arbeidet fremover.`;
  
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

export default async function AboutPage() {
    const members = await getMembers();

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1">
                <section className="bg-muted py-20 md:py-32">
                    <div className="container text-center">
                        <h1 className="text-5xl md:text-7xl font-bold font-headline">Om Oss</h1>
                        <p className="mt-4 text-lg max-w-3xl mx-auto text-muted-foreground">
                            Lær mer om vår bevegelse, vår visjon for Bergen, og menneskene som driver arbeidet fremover.
                        </p>
                    </div>
                </section>
                
                <section id="visjon" className="py-16 md:py-24">
                    <div className="container grid md:grid-cols-2 gap-12 items-center">
                         <div className="prose dark:prose-invert max-w-none">
                            <h2 className="font-headline text-3xl md:text-4xl">Vår Visjon</h2>
                            <p className="text-lg text-muted-foreground">
                              Arkitekturopprøret Bergen er en folkebevegelse som arbeider for å bevare og fremme byggekvaliteter som setter mennesket i sentrum. Vi ønsker arkitektur som er vakker, bærekraftig, og som skaper gode, trygge og inspirerende byrom for alle.
                            </p>
                            <p>
                                Vi tror på kraften i klassisk og tradisjonell arkitektur for å skape varige verdier og et bymiljø som folk trives i. Gjennom opplysning, debatt og konstruktiv dialog med utbyggere, politikere og byens innbyggere, jobber vi for at fremtidens Bergen skal bli enda vakrere enn fortidens.
                            </p>
                             <Button asChild size="lg" className="mt-4">
                                <Link href="/#contact">Engasjer deg</Link>
                            </Button>
                        </div>
                        <div className="relative aspect-square rounded-lg overflow-hidden">
                            <Image 
                                src="https://images.unsplash.com/photo-1663460563287-5dad8e16d609?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxM3x8QmVyZ2VufGVufDB8fHx8MTc1ODI1OTUzMXww&ixlib=rb-4.1.0&q=80&w=1080" 
                                alt="Illustrasjon av Bergens arkitektur" 
                                fill
                                objectFit="cover"
                                className="object-cover"
                                data-ai-hint="bergen norway"
                            />
                        </div>
                    </div>
                </section>

                <section id="styret" className="bg-muted py-16 md:py-24">
                    <div className="container">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-headline font-bold md:text-4xl">Møt Styret</h2>
                            <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                                Vårt arbeid drives av en engasjert gruppe frivillige.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                            {members.map((member) => (
                                <Card key={member.id} className="text-center border-0 bg-transparent shadow-none">
                                    <CardHeader className="p-0 items-center">
                                        <Avatar className="w-32 h-32 mb-4">
                                            {member.image && <AvatarImage src={member.image} alt={member.name} data-ai-hint="portrait person" className="object-cover" />}
                                            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                                        </Avatar>
                                        <CardTitle className="font-headline text-xl">{member.name}</CardTitle>
                                        <CardDescription>{member.role}</CardDescription>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>

            </main>
            <Footer />
        </div>
    );
}
