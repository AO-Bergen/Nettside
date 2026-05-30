

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User, deleteUser } from "firebase/auth";
import { useAuth, useFirestore, useStorage } from "@/firebase/index";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { doc, getDoc, deleteDoc } from "firebase/firestore";

import { Header } from "@/components/site/header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, LogOut, AlertTriangle, UserX, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const DASHBOARD_ROLES = ["Administrator", "Styremedlem", "Bidragsyter"];

function DeleteAccountDialog() {
    const firestore = useFirestore();
    const storage = useStorage();
    const { auth, openAuthDialog } = useAuth();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [countdown, setCountdown] = useState(10);
    const [isCountingDown, setIsCountingDown] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    const startCountdown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsCountingDown(true);
        setCountdown(10);
        timerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    handleDeleteAccount();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const stopCountdown = () => {
        setIsCountingDown(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setCountdown(10);
    };
    
    const handleCancel = () => {
        stopCountdown();
        setIsDialogOpen(false);
    }

    const handleDeleteAccount = async () => {
        const user = auth.currentUser;
        if (!user || !firestore || !storage) return;
        
        stopCountdown();

        try {
            const userDocRef = doc(firestore, 'users', user.uid);
            await deleteDoc(userDocRef);
            
            if (user.photoURL) {
                try {
                    const photoRef = storageRef(storage, user.photoURL);
                    await deleteObject(photoRef);
                } catch (storageError: any) {
                    if (storageError.code !== 'storage/object-not-found') {
                        console.warn("Could not delete profile picture during account deletion:", storageError);
                    }
                }
            }
            await deleteUser(user);
            toast({ title: "Konto slettet", description: "Din konto har blitt permanent slettet." });
            router.push('/');
        } catch (error: any) {
            console.error("Error deleting account:", error);
            if (error.code === 'auth/requires-recent-login') {
                toast({
                    title: "Sletting mislyktes",
                    description: "Av sikkerhetsgrunner må du logge inn på nytt før du kan slette kontoen din.",
                    variant: "destructive",
                });
                setIsDialogOpen(false);
                await signOut(auth);
                router.replace('/');
                openAuthDialog();
            } else {
                toast({
                    title: "Feil ved sletting",
                    description: error.message || "En feil oppstod under sletting av kontoen.",
                    variant: "destructive",
                });
                setIsDialogOpen(false);
            }
        }
    }

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const handleOpenChange = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) stopCountdown();
    };

    return (
        <AlertDialog open={isDialogOpen} onOpenChange={handleOpenChange}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                    <AlertTriangle className="mr-2 h-4 w-4"/>
                    Slett Kontoen Permanent
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Er du helt sikker?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {isCountingDown 
                            ? `Kontoen din slettes permanent om ${countdown}...`
                            : "Denne handlingen kan ikke angres. Dette vil permanent slette kontoen din og all tilhørende data."
                        }
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleCancel}>Avbryt</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={startCountdown} 
                        className={cn(buttonVariants({ variant: "destructive" }))} 
                        disabled={isCountingDown}
                    >
                        {isCountingDown ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Ja, slett min konto"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function DeactivatedAccountPage() {
    const { auth } = useAuth();
    const firestore = useFirestore();
    const [user, setUser] = useState<User | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (!auth || !firestore) return;
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const userDocRef = doc(firestore, 'users', currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                
                if(userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    setUserRole(userData.role);
                    // If user is active, they shouldn't be here. Redirect them.
                    if (userData.status === 'active' || !userData.status) {
                        router.replace('/my-profile');
                        return;
                    }
                }
                // If doc doesn't exist or user is deactivated, they can stay.
                setUser(currentUser);
            } else {
                router.replace("/"); // Redirect home if not logged in
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [auth, firestore, router]);

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/");
    };

    const hasDashboardAccess = userRole && DASHBOARD_ROLES.includes(userRole);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!user) return null;

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 py-16 md:py-24 bg-muted">
                <div className="container flex-grow flex items-center justify-center">
                    <Card className="w-full max-w-lg">
                        <CardHeader className="text-center items-center">
                            <UserX className="w-16 h-16 mb-4 text-destructive" />
                            <CardTitle className="font-headline text-2xl">Kontoen din er deaktivert</CardTitle>
                            <CardDescription>
                                Hei, {user.displayName || 'bruker'}. Din konto har blitt deaktivert av en administrator.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-center">
                            <p className="text-muted-foreground">
                                Dette betyr at du ikke lenger har tilgang til beskyttet innhold{hasDashboardAccess ? " eller styrepanelet" : ""}.
                                Hvis du mener dette er en feil, vennligst ta kontakt med oss.
                            </p>
                            <Button asChild variant="outline">
                                <a href="mailto:kontakt@arkitekturopproretbergen.no">
                                    <Mail className="mr-2 h-4 w-4" />
                                    Kontakt Oss
                                </a>
                            </Button>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4 pt-6">
                           <div className="w-full space-y-2">
                                <p className="text-center text-sm text-muted-foreground">
                                    Du kan velge å slette kontoen din permanent. Handlingen kan ikke angres.
                                </p>
                                <DeleteAccountDialog />
                           </div>
                           <div className="w-full pt-4 mt-2 border-t">
                             <Button onClick={handleLogout} variant="ghost" className="w-full">
                                <LogOut className="mr-2 h-4 w-4" />
                                Logg ut
                            </Button>
                           </div>
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    );
}
