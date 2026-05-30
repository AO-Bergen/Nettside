

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase/index";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export function ContactForm() {
    const firestore = useFirestore();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) return;
        if (!name || !email || !message) {
            toast({
                title: "Mangler informasjon",
                description: "Vennligst fyll ut alle feltene.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);

        try {
            const docRef = await addDoc(collection(firestore, "messages"), {
                type: 'Melding',
                name,
                email,
                phone: phone || "Ikke oppgitt",
                message,
                createdAt: serverTimestamp(),
                isRead: false,
                status: 'inbox',
            });

            // Fire-and-forget notification trigger.
            // This is not perfectly secure, as a client could spam this endpoint,
            // but it will only notify admins, not all users.
            // For higher security, this should be a Cloud Function trigger.
            fetch('/api/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'inbox',
                    payload: {
                        messageId: docRef.id,
                        senderName: name || 'Anonym'
                    }
                })
            }).catch(console.error); // Log error but don't block user UI

            toast({
                title: "Melding sendt!",
                description: "Takk for din henvendelse. Vi svarer deg så snart som mulig.",
            });

            // Reset form
            setName("");
            setEmail("");
            setPhone("");
            setMessage("");

        } catch (error) {
            console.error("Error submitting message: ", error);
            toast({
                title: "Noe gikk galt",
                description: "Kunne ikke sende meldingen din. Prøv igjen senere.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">Send oss en melding</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="contact-name">Ditt navn</Label>
                        <Input 
                            id="contact-name" 
                            placeholder="Ditt navn" 
                            aria-label="Ditt navn" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                         <Label htmlFor="contact-email">Din e-post</Label>
                        <Input 
                            id="contact-email"
                            type="email" 
                            placeholder="Din e-post" 
                            aria-label="Din e-post"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                         <Label htmlFor="contact-phone">Mobiltelefon (valgfritt)</Label>
                        <Input 
                            id="contact-phone"
                            type="tel" 
                            placeholder="Ditt telefonnummer" 
                            aria-label="Ditt telefonnummer"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="contact-message">Din melding</Label>
                        <Textarea 
                            id="contact-message"
                            placeholder="Din melding" 
                            aria-label="Din melding" 
                            rows={5}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isLoading}>
                         {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send melding"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
