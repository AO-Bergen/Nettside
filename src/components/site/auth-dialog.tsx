

'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { useAuth, useFirestore } from '@/firebase/index';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_LOGO } from '@/lib/constants';
import { FirebaseError } from 'firebase/app';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Separator } from '../ui/separator';
import Link from 'next/link';

export function AuthDialog() {
  const {
    isAuthDialogOpen,
    openAuthDialog,
    closeAuthDialog,
    user,
    signInWithGoogle,
    auth,
  } = useAuth();
  const firestore = useFirestore();

  const { toast } = useToast();
  const [logoSrc, setLogoSrc] = useState(DEFAULT_LOGO);
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Google Loading State
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    setLogoSrc(DEFAULT_LOGO);
  }, []);

  const handleSuccessfulLogin = (message: string) => {
    toast?.({
      title: 'Velkommen!',
      description: message,
    });
    closeAuthDialog();
    resetForms();
  };

  const resetForms = () => {
      setLoginEmail('');
      setLoginPassword('');
  }

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

  const handleEmailLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!firestore || !auth) return;

      setLoginLoading(true);
      try {
          await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
          handleSuccessfulLogin("Du er nå logget inn.");
      } catch (error: any) {
          let message = "En ukjent feil oppstod.";
            if (error instanceof FirebaseError) {
                switch(error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                    case 'auth/invalid-credential':
                        message = "Ugyldig e-post eller passord.";
                        break;
                    case 'auth/invalid-email':
                        message = "Ugyldig e-postadresse-format.";
                        break;
                    default:
                        message = "En feil oppstod under innlogging.";
                }
            }
          toast({ title: "Innlogging feilet", description: message, variant: "destructive" });
      } finally {
          setLoginLoading(false);
      }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      if (auth.currentUser) {
        await saveUserToFirestore(auth.currentUser);
      }
      handleSuccessfulLogin("Du er nå logget inn med Google.");
    } catch (error: any) {
        let message = 'Vennligst prøv igjen.';
        if (error instanceof FirebaseError) {
             switch (error.code) {
                case 'auth/popup-closed-by-user':
                    message = 'Innloggingsvinduet ble lukket. Vennligst prøv igjen.';
                    break;
                case 'auth/cancelled-popup-request':
                    message = 'Kun én innloggingsforespørsel er tillatt om gangen.';
                    break;
                case 'auth/account-exists-with-different-credential':
                    message = 'En konto med denne e-posten eksisterer allerede. Prøv å logge inn med en annen metode.';
                    break;
            }
        }
       
         toast?.({
            variant: 'destructive',
            title: 'Innlogging med Google feilet',
            description: message,
        });

    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAuthDialogOpen) {
      closeAuthDialog();
    }
  }, [user, isAuthDialogOpen, closeAuthDialog]);

  return (
    <Dialog open={isAuthDialogOpen} onOpenChange={(open) => (open ? openAuthDialog() : closeAuthDialog())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center">
          <div className="mx-auto mb-2">
            <Image
              src={logoSrc}
              alt="Logo"
              width={64}
              height={64}
              className="rounded"
              unoptimized
            />
          </div>
          <DialogTitle className="text-center text-2xl font-headline">Logg inn</DialogTitle>
          <DialogDescription className="text-center">
            Logg inn for å stemme eller bli medlem for å delta.
          </DialogDescription>
        </DialogHeader>

        <div className="pt-4">
             <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="login-email">E-postadresse</Label>
                    <Input id="login-email" type="email" placeholder="din@epost.no" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} disabled={loginLoading} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="login-password">Passord</Label>
                    <Input id="login-password" type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} disabled={loginLoading} />
                </div>
                <Button type="submit" className="w-full" disabled={loginLoading}>
                    {loginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Logg inn
                </Button>
            </form>
        </div>
        
        <div className="relative my-2">
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
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
        >
            {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                    <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 109.8 512 0 402.2 0 256S109.8 0 244 0c73 0 135.7 28.7 182.4 73.5l-68.6 68.6c-28.5-27.1-65.2-43.8-113.8-43.8-86.1 0-156.2 69.1-156.2 154.9s69.1 154.9 156.2 154.9c98.3 0 134.9-65.8 140-101.4h-140v-84h273.7c1.5 15.6 2.3 32.2 2.3 48.2z"></path>
                </svg>
            }
            Fortsett med Google
        </Button>

        <DialogFooter className="pt-2">
          <div className="w-full flex flex-col items-center text-center">
            <p className="text-sm">
              Ny bruker? <Link href="/bli-medlem" className="underline font-medium" onClick={closeAuthDialog}>Registrer deg her</Link>
            </p>
            <p className="text-[12px] text-muted-foreground">
              Ved å fortsette godtar du våre vilkår for bruk og personvern.
            </p>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
