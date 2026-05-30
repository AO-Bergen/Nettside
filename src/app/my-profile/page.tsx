

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
    onAuthStateChanged, 
    signOut, 
    User, 
    updateProfile, 
    deleteUser,
    GoogleAuthProvider,
    linkWithPopup,
    unlink
} from "firebase/auth";
import { useAuth, useFirestore, useStorage } from "@/firebase/index";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, setDoc, onSnapshot } from "firebase/firestore";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

import { Header } from "@/components/site/header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, LogOut, Edit, Save, X, Camera, AlertTriangle, BellRing } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { DEFAULT_LOGO, DEFAULT_ORG_NAME } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { UserVotes } from "@/components/site/user-votes";
import { Switch } from "@/components/ui/switch";


function StaticFooter() {
    const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO);
    const [orgName, setOrgName] = useState(DEFAULT_ORG_NAME);
    const firestore = useFirestore();

    useEffect(() => {
        async function fetchSettings() {
            if (!firestore) return;
            try {
                const docRef = doc(firestore, "settings", "siteConfig");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setLogoUrl(data.logoUrl || DEFAULT_LOGO);
                    setOrgName(data.orgName || DEFAULT_ORG_NAME);
                }
            } catch (error) {
                console.error("Error fetching site settings for static footer:", error);
            }
        }
        fetchSettings();
    }, [firestore]);


    return (
        <footer className="border-t py-6 md:py-8">
            <div className="container flex flex-col items-center justify-center gap-4 text-center">
                 <Image
                    src={logoUrl}
                    alt={`${orgName} logo`}
                    width={72}
                    height={72}
                    className="rounded-full"
                    unoptimized
                />
                <div className="text-balance text-sm leading-loose text-muted-foreground">
                    <p>Bygget med lidenskap for vakker arkitektur.</p>
                    <p>© {new Date().getFullYear()} {orgName}.</p>
                </div>
            </div>
        </footer>
    )
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
    return centerCrop(
        makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
        mediaWidth,
        mediaHeight,
    )
}

function DeleteAccountDialog() {
    const firestore = useFirestore();
    const storage = useStorage();
    const { auth } = useAuth();
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
                router.push("/login");
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
        if (!open) {
            stopCountdown();
        }
    };

    return (
        <AlertDialog open={isDialogOpen} onOpenChange={handleOpenChange}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                    <AlertTriangle className="mr-2 h-4 w-4"/>
                    Slett Konto
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

function NotificationSettings() {
    const { user } = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();

    // --- PUSH NOTIFICATIONS ---
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isPushSupported, setIsPushSupported] = useState(false);
    const [isPushLoading, setIsPushLoading] = useState(true);
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""; 

    // --- EMAIL NOTIFICATIONS ---
    const [emailOptIn, setEmailOptIn] = useState(true);
    const [isEmailLoading, setIsEmailLoading] = useState(true);
    
    // --- TOPIC PREFERENCES ---
    const [notificationPrefs, setNotificationPrefs] = useState<{ news: boolean, events: boolean, inbox: boolean }>({ news: true, events: true, inbox: true });
    const [isPrefsLoading, setIsPrefsLoading] = useState(true);
    
    // --- PERMISSIONS ---
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userPermissions, setUserPermissions] = useState<any>(null);
    const [isPermissionsLoading, setIsPermissionsLoading] = useState(true);


    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
            setIsPushSupported(true);
            setPermissionStatus(Notification.permission);
            navigator.serviceWorker.ready.then(reg => {
                reg.pushManager.getSubscription().then(sub => {
                    if (sub) {
                        setIsSubscribed(true);
                        setSubscription(sub);
                    }
                    setIsPushLoading(false);
                });
            });
        } else {
            setIsPushLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!user || !firestore) {
            setIsEmailLoading(false);
            setIsPrefsLoading(false);
            setIsPermissionsLoading(false);
            return;
        }
        setIsEmailLoading(true);
        setIsPrefsLoading(true);
        setIsPermissionsLoading(true);

        const userDocRef = doc(firestore, "users", user.uid);
        const unsub = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setEmailOptIn(data.emailOptIn !== false);
                setNotificationPrefs(data.notificationPreferences || { news: true, events: true, inbox: true });
                setUserPermissions(data.permissions || {});
                setUserRole(data.role || null);
            }
            setIsEmailLoading(false);
            setIsPrefsLoading(false);
            setIsPermissionsLoading(false);
        }, () => {
            setIsEmailLoading(false);
            setIsPrefsLoading(false);
            setIsPermissionsLoading(false);
        });
        return () => unsub();
    }, [user, firestore]);

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    const subscribeUser = async () => {
        if (!user || !firestore) return;
        if (!VAPID_PUBLIC_KEY) {
            toast({ title: "Konfigurasjon mangler", description: "VAPID public key er ikke satt i miljøvariablene.", variant: "destructive" });
            return;
        }
        setIsPushLoading(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
            const subObject = sub.toJSON();
            const subId = btoa(JSON.stringify(subObject.endpoint)).replace(/=/g, '');
            await setDoc(doc(firestore, 'pushSubscriptions', subId), {
                userId: user.uid,
                subscription: subObject,
                createdAt: serverTimestamp(),
            });
            setIsSubscribed(true);
            setSubscription(sub);
            setPermissionStatus('granted');
            toast({ title: "Varslinger er skrudd på!", description: "Du vil nå motta varsler på denne enheten." });
        } catch (error) {
            console.error("Failed to subscribe user:", error);
            toast({ title: "Kunne ikke abonnere", description: "Sjekk at du har tillatt varslinger for dette nettstedet.", variant: "destructive" });
        } finally {
            setIsPushLoading(false);
        }
    };
    
    const unsubscribeUser = async () => {
        if (!subscription || !user || !firestore) return;
        setIsPushLoading(true);
        try {
            await subscription.unsubscribe();
            const subId = btoa(JSON.stringify(subscription.endpoint)).replace(/=/g, '');
            await deleteDoc(doc(firestore, 'pushSubscriptions', subId));
            setIsSubscribed(false);
            setSubscription(null);
            toast({ title: "Varslinger er skrudd av." });
        } catch (error) {
            console.error("Failed to unsubscribe user:", error);
            toast({ title: "Kunne ikke fjerne abonnement", variant: "destructive" });
        } finally {
            setIsPushLoading(false);
        }
    };
    
    const handleSubscribeClick = async () => {
        const permission = await Notification.requestPermission();
        setPermissionStatus(permission);
        if (permission === 'granted') {
            await subscribeUser();
        } else {
            toast({ title: "Varslinger er blokkert", description: "Du må tillate varslinger i nettleserinnstillingene for å skru dem på.", variant: "destructive" });
        }
    };

    const handleToggleSubscription = async () => {
        if (isSubscribed) {
            await unsubscribeUser();
        } else {
            await handleSubscribeClick();
        }
    };
    
    const handleEmailToggle = async (checked: boolean) => {
        if (!user || !firestore) return;
        
        setIsEmailLoading(true);
        const userDocRef = doc(firestore, "users", user.uid);
        try {
            await updateDoc(userDocRef, { emailOptIn: checked });
            toast({ title: "E-postvarslinger oppdatert." });
        } catch (error) {
            console.error("Failed to update email preference:", error);
            toast({ title: "Noe gikk galt", variant: "destructive" });
        }
    };
    
    const handlePreferenceToggle = async (topic: 'news' | 'events' | 'inbox', checked: boolean) => {
        if (!user || !firestore) return;
        
        setIsPrefsLoading(true);
        const userDocRef = doc(firestore, "users", user.uid);
        try {
            await updateDoc(userDocRef, {
                [`notificationPreferences.${topic}`]: checked
            });
        } catch (error) {
            console.error("Failed to update notification preference:", error);
            toast({ title: "Noe gikk galt", variant: "destructive" });
        }
    };
    
    const isAdmin = userRole === 'Administrator';

    if (!isPushSupported && isEmailLoading) {
      return null;
    }

    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Varslinger</CardTitle>
          <CardDescription>
            Administrer hvordan du mottar varsler om viktige hendelser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 divide-y divide-border">
            {isPushSupported && (
                 <div className="flex items-center justify-between pt-4 first:pt-0">
                    <div className="space-y-1">
                        <Label htmlFor="push-switch" className="text-base">Push-varslinger</Label>
                        <p className="text-[0.8rem] text-muted-foreground">
                            Motta varsler direkte på denne enheten.
                        </p>
                         {!isSubscribed && permissionStatus === 'default' && (
                            <Button variant="outline" size="sm" className="mt-2" onClick={handleSubscribeClick} disabled={isPushLoading}>
                                <BellRing className="mr-2 h-4 w-4" />
                                Aktiver varslinger
                            </Button>
                        )}
                        {permissionStatus === 'denied' && (
                             <p className="text-xs text-destructive mt-2">Du har blokkert varslinger. Du må endre dette i nettleserinnstillingene.</p>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        {isPushLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        <Switch
                        id="push-switch"
                        checked={isSubscribed}
                        onCheckedChange={handleToggleSubscription}
                        disabled={isPushLoading || permissionStatus === 'denied'}
                        />
                    </div>
                 </div>
            )}
            <div className="flex items-center justify-between pt-4 first:pt-0">
                 <div className="space-y-0.5">
                    <Label htmlFor="email-switch" className="text-base">E-postvarslinger</Label>
                    <p className="text-[0.8rem] text-muted-foreground">
                        Motta e-post om viktige kunngjøringer.
                    </p>
                 </div>
                <div className="flex items-center space-x-2">
                    {isEmailLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Switch
                        id="email-switch"
                        checked={emailOptIn}
                        onCheckedChange={handleEmailToggle}
                        disabled={isEmailLoading}
                    />
                </div>
            </div>
        </CardContent>

        {isSubscribed && (
            <>
                <CardHeader className="pt-6">
                    <CardTitle>Innstillinger for Push-varsler</CardTitle>
                    <CardDescription>Velg hva du vil motta varsler om.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 divide-y">
                     <div className="flex items-center justify-between pt-4 first:pt-0">
                        <Label htmlFor="news-switch" className="flex flex-col gap-1 pr-4">
                            <span>Nye nyhetsartikler</span>
                            <span className="font-normal text-muted-foreground text-xs">Få varsel når en nyhet publiseres.</span>
                        </Label>
                        <div className="flex items-center space-x-2">
                             {isPrefsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                             <Switch
                                id="news-switch"
                                checked={notificationPrefs.news}
                                onCheckedChange={(checked) => handlePreferenceToggle('news', checked)}
                                disabled={isPrefsLoading}
                             />
                        </div>
                    </div>
                     <div className="flex items-center justify-between pt-4 first:pt-0">
                        <Label htmlFor="events-switch" className="flex flex-col gap-1 pr-4">
                            <span>Nye arrangementer</span>
                            <span className="font-normal text-muted-foreground text-xs">Få varsel om kommende arrangementer.</span>
                        </Label>
                        <div className="flex items-center space-x-2">
                             {isPrefsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                             <Switch
                                id="events-switch"
                                checked={notificationPrefs.events}
                                onCheckedChange={(checked) => handlePreferenceToggle('events', checked)}
                                disabled={isPrefsLoading}
                             />
                        </div>
                    </div>
                    {isPermissionsLoading ? <div className="flex justify-center pt-4"><Loader2 className="h-5 w-5 animate-spin"/></div> : (
                        (isAdmin || userPermissions?.inbox?.read) && (
                            <div className="flex items-center justify-between pt-4 first:pt-0">
                                <Label htmlFor="inbox-switch" className="flex flex-col gap-1 pr-4">
                                    <span>Nye meldinger i innboks</span>
                                    <span className="font-normal text-muted-foreground text-xs">Få varsel når noen sender en melding via kontaktskjemaet.</span>
                                </Label>
                                <div className="flex items-center space-x-2">
                                     {isPrefsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                     <Switch
                                        id="inbox-switch"
                                        checked={notificationPrefs.inbox}
                                        onCheckedChange={(checked) => handlePreferenceToggle('inbox', checked)}
                                        disabled={isPrefsLoading}
                                     />
                                </div>
                            </div>
                        )
                    )}
                </CardContent>
            </>
        )}
      </Card>
    );
}

export default function MyProfilePage() {
    const { auth } = useAuth();
    const firestore = useFirestore();
    const storage = useStorage();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [photoFile, setPhotoFile] = useState<Blob | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isGoogleLinked, setIsGoogleLinked] = useState(false);
    const [isLinking, setIsLinking] = useState(false);


    const [imgSrc, setImgSrc] = useState('');
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<Crop>();
    const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setDisplayName(currentUser.displayName || "");
                setPhotoPreview(currentUser.photoURL || null);
                const isGoogle = currentUser.providerData.some(p => p.providerId === 'google.com');
                setIsGoogleLinked(isGoogle);

                if (firestore) {
                    try {
                        const userDocRef = doc(firestore, "users", currentUser.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        if (!userDocSnap.exists()) {
                            await setDoc(userDocRef, {
                                name: currentUser.displayName,
                                email: currentUser.email,
                                role: 'Medlem',
                                status: 'active',
                                emailOptIn: true,
                                createdAt: serverTimestamp(),
                            });
                        }
                    } catch (error) {
                        console.error("Error checking/creating user data in Firestore:", error);
                    }
                }

            } else {
                router.push("/");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [auth, router, firestore]);

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/");
    };

    const handleEditToggle = () => {
        if (isEditing) {
            if (user) {
                setDisplayName(user.displayName || "");
                setPhotoFile(null);
                setPhotoPreview(user.photoURL || null);
            }
        }
        setIsEditing(!isEditing);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setCrop(undefined)
            const reader = new FileReader();
            reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
            reader.readAsDataURL(e.target.files[0]);
            setIsCropDialogOpen(true);
        }
    };
    
    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height, 1));
    }

    const handleCropComplete = async () => {
        if (completedCrop?.width && completedCrop?.height && imgRef.current) {
            const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop);
            setPhotoFile(croppedImageBlob);
            setPhotoPreview(URL.createObjectURL(croppedImageBlob));
        }
        setIsCropDialogOpen(false);
        setImgSrc('');
    };

    function getCroppedImg(image: HTMLImageElement, crop: Crop): Promise<Blob> {
        const canvas = document.createElement('canvas');
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        canvas.width = crop.width;
        canvas.height = crop.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return Promise.reject(new Error('2D context not available'));
        }

        const pixelRatio = window.devicePixelRatio;
        canvas.width = crop.width * pixelRatio;
        canvas.height = crop.height * pixelRatio;
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            crop.width,
            crop.height
        );
        
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Canvas is empty'));
                        return;
                    }
                    resolve(blob);
                },
                'image/jpeg',
                0.95
            );
        });
    }

    const handleSave = async () => {
        if (!user || !firestore || !storage) return;
        setIsSaving(true);
        
        try {
            let newPhotoURL = user.photoURL;

            if (photoFile) {
                if (user.photoURL) {
                    try {
                        const oldPhotoRef = storageRef(storage, user.photoURL);
                        await deleteObject(oldPhotoRef);
                    } catch (error: any) {
                        if (error.code !== 'storage/object-not-found') {
                            console.warn("Could not delete old profile picture:", error);
                        }
                    }
                }

                const fileExtension = 'jpg';
                const newFileName = `${user.uid}-profile.${fileExtension}`;
                const filePath = `Personer/Profil Bilder/${newFileName}`;
                const fileRef = storageRef(storage, filePath);
                
                const uploadResult = await uploadBytes(fileRef, photoFile);
                newPhotoURL = await getDownloadURL(uploadResult.ref);
            }
            
            await updateProfile(user, {
                displayName: displayName,
                photoURL: newPhotoURL
            });

            const userDocRef = doc(firestore, "users", user.uid);
            await updateDoc(userDocRef, {
                name: displayName,
            });

            await user.reload();
            setUser(auth.currentUser);
            if (auth.currentUser) {
                setPhotoPreview(auth.currentUser.photoURL || null);
            }

            toast({ title: "Profil oppdatert!", description: "Dine endringer har blitt lagret." });
            setIsEditing(false);
            setPhotoFile(null);

        } catch (error: any) {
             toast({ title: "Feil ved lagring", description: error.message || "Kunne ikke lagre profilen din.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleLinkGoogle = async () => {
        if (!user) return;
        setIsLinking(true);
        const provider = new GoogleAuthProvider();
        try {
            await linkWithPopup(user, provider);
            await user.reload();
            setUser(auth.currentUser);
            setIsGoogleLinked(true);
            toast({
                title: "Google-konto koblet til!",
                description: "Du kan nå logge inn med Google.",
            });
        } catch (error: any) {
            let message = "En ukjent feil oppstod.";
            if (error.code === 'auth/credential-already-in-use') {
                message = "Denne Google-kontoen er allerede koblet til en annen bruker.";
            } else if (error.code === 'auth/popup-closed-by-user') {
                message = 'Tilkoblingsvinduet ble lukket før fullføring.';
            }
            toast({
                title: "Tilkobling feilet",
                description: message,
                variant: "destructive",
            });
        } finally {
            setIsLinking(false);
        }
    };

    const getInitials = (name: string | null) => {
        if (!name) return "U";
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }

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
                <div className="container space-y-8">
                    <Card className="w-full max-w-md mx-auto">
                        <CardHeader className="text-center items-center">
                            <div className="relative group">
                                <Avatar className="w-24 h-24 mb-4">
                                    {photoPreview && <AvatarImage src={photoPreview} alt={displayName || 'User'} className="object-cover" />}
                                    <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                                </Avatar>
                                {isEditing && (
                                    <Label htmlFor="photo-upload" className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="h-8 w-8 text-white" />
                                        <Input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                    </Label>
                                )}
                            </div>
                            <CardTitle className="font-headline text-2xl">Min Profil</CardTitle>
                            {!isEditing && <CardDescription>Velkommen, {user.displayName || 'bruker'}!</CardDescription>}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {isEditing ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="displayName">Navn</Label>
                                        <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                                    </div>
                                     <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">E-post</p>
                                        <p>{user.email} (kan ikke endres)</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Navn</p>
                                        <p>{user.displayName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">E-post</p>
                                        <p>{user.email}</p>
                                    </div>
                                </>
                            )}
                        </CardContent>
                        <CardFooter className="flex flex-col gap-2">
                            {isEditing ? (
                                <>
                                <Button onClick={handleSave} className="w-full" disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    Lagre Endringer
                                </Button>
                                <Button onClick={handleEditToggle} variant="ghost" className="w-full">
                                    <X className="mr-2 h-4 w-4"/>
                                    Avbryt
                                </Button>
                                </>
                            ) : (
                                 <Button onClick={handleEditToggle} variant="outline" className="w-full">
                                    <Edit className="mr-2 h-4 w-4" />
                                    Rediger Profil
                                </Button>
                            )}

                            <div className="w-full pt-4 mt-2 border-t space-y-4">
                                {!isGoogleLinked ? (
                                    <Button variant="outline" className="w-full" onClick={handleLinkGoogle} disabled={isLinking}>
                                        {isLinking ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                                <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 109.8 512 0 402.2 0 256S109.8 0 244 0c73 0 135.7 28.7 182.4 73.5l-68.6 68.6c-28.5-27.1-65.2-43.8-113.8-43.8-86.1 0-156.2 69.1-156.2 154.9s69.1 154.9 156.2 154.9c98.3 0 134.9-65.8 140-101.4h-140v-84h273.7c1.5 15.6 2.3 32.2 2.3 48.2z"></path>
                                            </svg>
                                        )}
                                        Koble til Google-konto
                                    </Button>
                                ) : (
                                    <div className="flex items-center justify-center text-sm text-muted-foreground p-2 bg-muted rounded-md">
                                        <svg className="mr-2 h-4 w-4 text-green-600" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                            <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 109.8 512 0 402.2 0 256S109.8 0 244 0c73 0 135.7 28.7 182.4 73.5l-68.6 68.6c-28.5-27.1-65.2-43.8-113.8-43.8-86.1 0-156.2 69.1-156.2 154.9s69.1 154.9 156.2 154.9c98.3 0 134.9-65.8 140-101.4h-140v-84h273.7c1.5 15.6 2.3 32.2 2.3 48.2z"></path>
                                        </svg>
                                        <span>Google-konto er koblet til</span>
                                    </div>
                                )}
                                <DeleteAccountDialog />
                            </div>

                            <Button onClick={handleLogout} variant="ghost" className="w-full mt-2">
                                <LogOut className="mr-2 h-4 w-4" />
                                Logg ut
                            </Button>
                        </CardFooter>
                    </Card>

                    <NotificationSettings />

                    {user && <UserVotes userId={user.uid} />}
                </div>
            </main>
            <StaticFooter />
            <Dialog open={isCropDialogOpen} onOpenChange={setIsCropDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Beskjær bildet ditt</DialogTitle>
                        <DialogDescription>
                            Velg utsnittet du vil bruke som profilbilde.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 flex justify-center">
                        {imgSrc && (
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={1}
                                circularCrop
                            >
                                <img
                                    ref={imgRef}
                                    alt="Crop me"
                                    src={imgSrc}
                                    style={{ transform: `scale(1) rotate(0deg)` }}
                                    onLoad={onImageLoad}
                                />
                            </ReactCrop>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCropDialogOpen(false)}>Avbryt</Button>
                        <Button onClick={handleCropComplete}>Bruk bilde</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
