
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { 
  DEFAULT_LOGO, 
  DEFAULT_ORG_NAME 
} from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";

export default async function PressePage() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 py-16 md:py-24 bg-muted">
                <div className="container">
                    <div className="max-w-3xl mx-auto text-center">
                        <h1 className="text-5xl md:text-7xl font-bold font-headline">Presse</h1>
                        <p className="mt-4 text-lg max-w-3xl mx-auto text-muted-foreground">
                            Her finner du pressekontakt, nedlastbart materiale og annen relevant informasjon for journalister.
                        </p>
                    </div>

                    <div className="mt-16 grid md:grid-cols-2 gap-8">
                        <Card>
                            <CardHeader>
                                <CardTitle className="font-headline text-2xl">Pressekontakt</CardTitle>
                                <CardDescription>For offisielle uttalelser og intervjuforespørsler.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="font-semibold">Navn Navnesen</p>
                                <div className="flex items-center gap-4">
                                    <Mail className="w-5 h-5 text-primary" />
                                    <a href="mailto:presse@example.com" className="text-muted-foreground hover:text-foreground">
                                        presse@arkitekturopproretbergen.no
                                    </a>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Phone className="w-5 h-5 text-primary" />
                                    <span className="text-muted-foreground">+47 123 45 678</span>
                                </div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader>
                                <CardTitle className="font-headline text-2xl">Pressemateriell</CardTitle>
                                <CardDescription>Logoer, bilder og pressemeldinger.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground">
                                    En lenke til en sky-mappe (f.eks. Google Drive eller Dropbox) med relevant materiale vil bli lagt til her.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
