

"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Lightbulb, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase/index";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export function TipsForm() {
    const firestore = useFirestore();
    const [buildingName, setBuildingName] = useState("");
    const [tip, setTip] = useState("");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) return;
        if (!buildingName || !tip) {
            toast({
                title: "Mangler informasjon",
                description: "Vennligst fyll ut bygningsnavn og selve tipset.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        try {
            const docRef = await addDoc(collection(firestore, "messages"), {
                type: 'Tips',
                projectName: buildingName,
                message: tip,
                name: name || "Anonym",
                email: email || "Ikke oppgitt",
                createdAt: serverTimestamp(),
                isRead: false,
                status: 'inbox',
            });

            // Fire-and-forget notification trigger.
            fetch('/api/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'inbox',
                    payload: {
                        messageId: docRef.id,
                        senderName: `Tips om ${buildingName}`
                    }
                })
            }).catch(console.error);

            toast({
                title: "Takk for tipset!",
                description: "Vi har mottatt tipset ditt og vil se på det.",
            });

            // Reset form
            setBuildingName("");
            setTip("");
            setName("");
            setEmail("");

        } catch (error) {
            console.error("Error submitting tip: ", error);
            toast({
                title: "Noe gikk galt",
                description: "Kunne ikke sende inn tipset ditt. Prøv igjen senere.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
                <div className="mx-auto bg-primary/10 text-primary p-3 rounded-full w-fit mb-4">
                    <Lightbulb className="w-8 h-8" />
                </div>
                <CardTitle className="font-headline text-3xl">Tips oss om en bygning!</CardTitle>
                <CardDescription>
                    Har du sett en bygning i Bergen—enten vakker eller stygg—som du mener vi bør se på? <br /> Fyll ut skjemaet under for å sende oss et tips.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="bygning">Bygningens navn eller adresse</Label>
                        <Input
                            id="bygning"
                            placeholder="F.eks. Nygårdsgaten 5"
                            required
                            value={buildingName}
                            onChange={(e) => setBuildingName(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tips">Ditt tips</Label>
                        <Textarea
                            id="tips"
                            placeholder="Fortell oss hva du har sett og hvorfor vi bør se på det. Inkluder gjerne lenker til artikler eller bilder."
                            rows={6}
                            required
                            value={tip}
                            onChange={(e) => setTip(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="navn">Ditt navn (valgfritt)</Label>
                            <Input
                                id="navn"
                                placeholder="Ola Nordmann"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="epost">Din e-post (valgfritt)</Label>
                            <Input
                                id="epost"
                                type="email"
                                placeholder="ola@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                        <p className="text-xs text-muted-foreground pt-2">
                        Vi kontakter deg kun hvis vi trenger mer informasjon om tipset ditt.
                    </p>
                    <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send tips"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
