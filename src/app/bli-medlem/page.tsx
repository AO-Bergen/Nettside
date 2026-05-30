'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, useFirestore } from '@/firebase/index';
import { Header } from '@/components/site/header';
import { Footer } from '@/components/site/footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, UserPlus } from 'lucide-react';
import { FirebaseError } from 'firebase/app';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function BliMedlemPage() {
  const { auth, user, signInWithGoogle } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  useEffect(() => {
    // If user is already logged in, redirect them to their profile
    if (user) {
        router.replace('/my-profile');
    }
  }, [user, router]);

  const saveUserToFirestore = async (user: any, role = "Medlem") => {
    if (!firestore) return;
    const userRef = doc(firestore, "users", user.uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
        await setDoc(userRef, {
            name: user.displayName,
            email: user.email,
            role: role,
            status: 'active',
            createdAt: serverTimestamp(),
        });
    }
  };
  
  const handleSuccessfulRegistration = (message: string) => {
    toast?.({
      title: 'Velkommen!',
      description: message,
    });
    router.push('/my-profile'); // Redirect after successful registration
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setSignupLoading(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
        await updateProfile(userCredential.user, { displayName: signupName });
        await saveUserToFirestore(userCredential.user);
        handleSuccessfulRegistration("Kontoen din er opprettet og du er nå logget inn.");
    } catch (error: any) {
        let message = "En ukjent feil oppstod.";
        if (error instanceof FirebaseError) {
            switch(error.code) {
                case 'auth/email-already-in-use': message = "Denne e-postadressen er allerede i bruk."; break;
                case 'auth/weak-password': message = "Passordet er for svakt. Bruk minst 6 tegn."; break;
                case 'auth/invalid-email': message = "Ugyldig e-postadresse."; break;
                default: message = `Feil: ${error.message}`;
            }
        }
        toast({ title: "Registrering feilet", description: message, variant: "destructive" });
    } finally {
        setSignupLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      if (auth.currentUser) {
          await saveUserToFirestore(auth.currentUser);
      }
      handleSuccessfulRegistration("Du er nå registrert og logget inn med Google.");
    } catch {
      toast?.({
        variant: 'destructive',
        title: 'Kunne ikke registrere',
        description: 'Prøv igjen senere.',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 py-16 md:py-24 bg-muted">
            <div className="container flex-grow flex items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardHeader className="items-center text-center">
                        <div className="p-4 bg-primary/10 text-primary rounded-full mb-4">
                            <UserPlus className="h-10 w-10" />
                        </div>
                        <CardTitle className="font-headline text-3xl">Bli Medlem</CardTitle>
                        <CardDescription className="text-lg">
                           Støtt vårt arbeid for en vakrere by!
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={handleEmailSignUp} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="signup-name">Fullt navn</Label>
                                <Input id="signup-name" placeholder="Ola Nordmann" required value={signupName} onChange={e => setSignupName(e.target.value)} disabled={signupLoading} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="signup-email">E-postadresse</Label>
                                <Input id="signup-email" type="email" placeholder="ola@example.com" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)} disabled={signupLoading}/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="signup-password">Passord</Label>
                                <Input id="signup-password" type="password" placeholder="Minst 6 tegn" required value={signupPassword} onChange={e => setSignupPassword(e.target.value)} disabled={signupLoading}/>
                            </div>
                            <Button type="submit" className="w-full" disabled={signupLoading}>
                                {signupLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Opprett konto med E-post
                            </Button>
                        </form>
                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <Separator />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">Eller</span>
                            </div>
                        </div>
                         <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleGoogleSignUp}
                            disabled={googleLoading}
                        >
                            {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                    <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 109.8 512 0 402.2 0 256S109.8 0 244 0c73 0 135.7 28.7 182.4 73.5l-68.6 68.6c-28.5-27.1-65.2-43.8-113.8-43.8-86.1 0-156.2 69.1-156.2 154.9s69.1 154.9 156.2 154.9c98.3 0 134.9-65.8 140-101.4h-140v-84h273.7c1.5 15.6 2.3 32.2 2.3 48.2z"></path>
                                </svg>
                            }
                            Registrer deg med Google
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </main>
        <Footer />
    </div>
  );
}
