
"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Twitter } from "lucide-react";
import { 
  DEFAULT_LOGO, 
  DEFAULT_ORG_NAME,
  DEFAULT_SOCIAL_FACEBOOK,
  DEFAULT_SOCIAL_INSTAGRAM,
  DEFAULT_SOCIAL_TWITTER
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { useFirestore } from "@/firebase/index";


type FooterSettings = {
    logoUrl: string;
    orgName: string;
    socialLinks: {
        facebook: string;
        instagram: string;
        twitter: string;
    }
}

export const Footer = () => {
    const firestore = useFirestore();
    const [settings, setSettings] = useState<FooterSettings>({
        logoUrl: DEFAULT_LOGO,
        orgName: DEFAULT_ORG_NAME,
        socialLinks: {
            facebook: DEFAULT_SOCIAL_FACEBOOK,
            instagram: DEFAULT_SOCIAL_INSTAGRAM,
            twitter: DEFAULT_SOCIAL_TWITTER
        }
    });

    useEffect(() => {
        async function getSiteSettings() {
            if (!firestore) return;
            try {
                const docRef = doc(firestore, "settings", "siteConfig");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  setSettings({
                    logoUrl: data.logoUrl || DEFAULT_LOGO,
                    orgName: data.orgName || DEFAULT_ORG_NAME,
                    socialLinks: data.socialLinks || {
                        facebook: DEFAULT_SOCIAL_FACEBOOK,
                        instagram: DEFAULT_SOCIAL_INSTAGRAM,
                        twitter: DEFAULT_SOCIAL_TWITTER
                    }
                  });
                }
              } catch (error) {
                console.error("Error fetching site settings for footer:", error);
              }
        }
        getSiteSettings();
    }, [firestore]);
    
    const footerLinks = [
        { href: "/news", label: "Nyheter" },
        { href: "/events", label: "Arrangementer" },
        { href: "/anbefalinger", label: "Anbefalinger" },
        { href: "/about", label: "Om Oss" },
        { href: "/presse", label: "Presse" },
        { href: "/tips-oss", label: "Tips Oss" },
        { href: "/bli-medlem", label: "Bli Medlem" },
        { href: "/#contact", label: "Kontakt" },
    ];

    return (
        <footer className="border-t py-8 md:py-12">
            <div className="container flex flex-col items-center justify-center gap-6 text-center">
                <Image
                    src={settings.logoUrl}
                    alt={`${settings.orgName} logo`}
                    width={72}
                    height={72}
                    className="rounded-full"
                    unoptimized
                />
                <p className="font-headline font-semibold text-lg">{settings.orgName}</p>
                <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                    {footerLinks.map(link => (
                        <Link key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            {link.label}
                        </Link>
                    ))}
                </nav>
                 <div className="flex items-center gap-2">
                    {settings.socialLinks.facebook && (
                        <Button variant="ghost" size="icon" asChild>
                            <Link href={settings.socialLinks.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                                <Facebook className="h-5 w-5" />
                            </Link>
                        </Button>
                    )}
                     {settings.socialLinks.instagram && (
                        <Button variant="ghost" size="icon" asChild>
                            <Link href={settings.socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                                <Instagram className="h-5 w-5" />
                            </Link>
                        </Button>
                    )}
                     {settings.socialLinks.twitter && (
                        <Button variant="ghost" size="icon" asChild>
                            <Link href={settings.socialLinks.twitter} target="_blank" rel="noopener noreferrer" aria-label="X/Twitter">
                                <Twitter className="h-5 w-5" />
                            </Link>
                        </Button>
                    )}
                </div>
                <div className="w-full pt-6 mt-6 border-t space-y-2">
                    <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} {settings.orgName}</p>
                    <p className="text-xs text-muted-foreground/80">Nettside utformet av <a href="https://Solheim.Online" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Kianosh F. Solheim</a> på vegne av Arkitekturopprøret Bergen</p>
                </div>
            </div>
        </footer>
    );
};
