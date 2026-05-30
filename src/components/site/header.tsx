
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, LayoutDashboard, LogOut, User as UserIcon, ChevronDown, Building2, Database, Map, Newspaper, Calendar, Info, Eye, Users, Briefcase, Lightbulb, Mail, Library, Search } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { useFirestore } from "@/firebase/index";
import { cn } from "@/lib/utils";
import React from "react";
import { navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import { DEFAULT_LOGO, DEFAULT_ORG_NAME } from "@/lib/constants";
import { SearchDialog } from "./search-dialog";


export const Header = () => {
  const { user, auth, openAuthDialog } = useAuth();
  const firestore = useFirestore();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<string>('active');
  const [userPermissions, setUserPermissions] = useState<any | null>(null);
  const [userDataLoading, setUserDataLoading] = useState(true);
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [modifierKey, setModifierKey] = useState("⌘");

  const [orgName, setOrgName] = useState(DEFAULT_ORG_NAME);
  const [logoSrc, setLogoSrc] = useState(DEFAULT_LOGO);

  useEffect(() => {
    const isMac = /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
    if (!isMac) {
      setModifierKey("Ctrl");
    }
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsSearchOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])


  useEffect(() => {
    async function fetchSettings() {
      if (!firestore) return;
      try {
        const docRef = doc(firestore, "settings", "siteConfig");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrgName(data.orgName || DEFAULT_ORG_NAME);
          setLogoSrc(data.logoUrl || DEFAULT_LOGO);
        }
      } catch (error) {
        console.error("Error fetching site settings for header:", error);
      }
    }
    fetchSettings();
  }, [firestore]);
  
  useEffect(() => {
    async function fetchUserData() {
        if (user && firestore) {
            const userDocRef = doc(firestore, "users", user.uid);
            try {
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    setUserRole(userData.role);
                    setUserPermissions(userData.permissions || {});
                    setUserStatus(userData.status || 'active');
                } else {
                    setUserRole("Medlem");
                    setUserPermissions({});
                    setUserStatus('active');
                }
            } catch (e) {
                console.error("Error fetching user data for header", e);
                setUserRole(null);
                setUserPermissions(null);
            } finally {
                setUserDataLoading(false);
            }
        } else {
            setUserRole(null);
            setUserPermissions(null);
            setUserStatus('active');
            setUserDataLoading(false);
        }
    }
    fetchUserData();
  }, [user, firestore]);

  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        if (window.scrollY > lastScrollY && window.scrollY > 80) {
          setHidden(true);
        } else {
          setHidden(false);
        }
        setLastScrollY(window.scrollY);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', controlNavbar);
      return () => {
        window.removeEventListener('scroll', controlNavbar);
      };
    }
  }, [lastScrollY]);


  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
      router.push('/');
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  const publicLinks = [
    { href: "/news", label: "Nyheter" },
    { href: "/events", label: "Arrangementer" },
    { href: "/anbefalinger", label: "Anbefalinger" },
  ];
  
  const MobileNavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link
      href={href}
      className="flex w-full items-center gap-4 transition-colors hover:text-foreground/80 text-foreground/60"
      onClick={() => setIsSheetOpen(false)}
    >
      {children}
    </Link>
  );

  const hasDashboardAccess = userRole === 'Administrator' || (userPermissions && Object.values(userPermissions).some((p: any) => p.read));
  const isDeactivated = userStatus === 'deactivated';

  const avatarLink = isDeactivated ? "/my-profile/deactivated" : "/my-profile";

  return (
    <>
      <header className={cn("sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-transform duration-300", hidden && "-translate-y-full")}>
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 mr-4">
            <Image
              src={logoSrc}
              alt={`${orgName} logo`}
              width={40}
              height={40}
              className="rounded-full"
              unoptimized
            />
            <span className="font-body font-bold text-lg hidden sm:inline-block">
              {orgName}
            </span>
          </Link>
          
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
              <DropdownMenu>
                  <DropdownMenuTrigger className={cn(navigationMenuTriggerStyle(), "flex items-center gap-1")}>
                      Bygninger <ChevronDown className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuItem asChild>
                          <Link href="/buildings">Bygningsdatabasen</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                          <Link href="/buildings/map">Interaktivt Kart</Link>
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>

            {publicLinks.map((link) => (
              <Link key={link.href} href={link.href} className={navigationMenuTriggerStyle()}>
                  {link.label}
              </Link>
            ))}
              <DropdownMenu>
                  <DropdownMenuTrigger className={cn(navigationMenuTriggerStyle(), "flex items-center gap-1")}>
                      Om Oss <ChevronDown className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuItem asChild>
                          <Link href="/about#visjon">Vår Visjon</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                          <Link href="/about#styret">Styret</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                          <Link href="/presse">Presse</Link>
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
              <Link href="/tips-oss" className={navigationMenuTriggerStyle()}>
                  Tips Oss
              </Link>
              <Link href="/#contact" className={navigationMenuTriggerStyle()}>
                  Kontakt
              </Link>
          </nav>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSearchOpen(true)}>
                <Search className="h-6 w-6" />
                <span className="sr-only">Søk</span>
              </Button>
              <Button variant="outline" className="hidden md:flex gap-2 text-muted-foreground" onClick={() => setIsSearchOpen(true)}>
                  <Search className="h-4 w-4" />
                  Søk...
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                      <span className="text-xs">{modifierKey}</span>K
                  </kbd>
              </Button>

              <ThemeToggle />
              {!user ? (
                <Button variant="ghost" onClick={openAuthDialog} className="hidden lg:inline-flex">
                  <UserIcon className="mr-2 h-4 w-4" />
                  Logg inn
                </Button>
              ) : (
                <div className="hidden lg:flex items-center gap-2">
                  {user && !userDataLoading && hasDashboardAccess && !isDeactivated && (
                    <Button asChild size="icon" variant="ghost">
                      <Link href="/dashboard" aria-label="Styrepanelet">
                        <LayoutDashboard />
                      </Link>
                    </Button>
                  )}
                  <Link href={avatarLink}>
                    <Avatar className="h-8 w-8">
                      {user.photoURL && (
                        <AvatarImage
                          src={user.photoURL}
                          alt={user.displayName || "User"}
                        />
                      )}
                      <AvatarFallback>
                        {getInitials(user.displayName)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                </div>
              )}
            </div>
            <div className="lg:hidden flex items-center">
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Åpne meny</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full max-w-sm">
                  <SheetHeader>
                    <Link href="/" className="flex items-center gap-2" onClick={() => setIsSheetOpen(false)}>
                      <Image
                          src={logoSrc}
                          alt={`${orgName} logo`}
                          width={32}
                          height={32}
                          className="rounded-full"
                          unoptimized
                        />
                        <SheetTitle>{orgName}</SheetTitle>
                    </Link>
                  </SheetHeader>
                  <nav className="text-lg font-medium mt-8">
                    <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="bygninger" className="border-b-0">
                              <AccordionTrigger className="py-4 font-medium text-lg text-foreground/60 hover:text-foreground/80 hover:no-underline">
                                  <div className="flex items-center gap-4"><Building2 className="w-5 h-5"/>Bygninger</div>
                              </AccordionTrigger>
                              <AccordionContent className="pl-4 space-y-4">
                                  <MobileNavLink href="/buildings"><Database className="w-5 h-5"/>Bygningsdatabasen</MobileNavLink>
                                  <MobileNavLink href="/buildings/map"><Map className="w-5 h-5"/>Kart</MobileNavLink>
                              </AccordionContent>
                          </AccordionItem>
                          <div className="py-4">
                              <MobileNavLink href="/news"><Newspaper className="w-5 h-5"/>Nyheter</MobileNavLink>
                          </div>
                          <div className="py-4">
                              <MobileNavLink href="/events"><Calendar className="w-5 h-5"/>Arrangementer</MobileNavLink>
                          </div>
                          <div className="py-4">
                              <MobileNavLink href="/anbefalinger"><Library className="w-5 h-5"/>Anbefalinger</MobileNavLink>
                          </div>
                          <AccordionItem value="om-oss" className="border-b-0">
                              <AccordionTrigger className="py-4 font-medium text-lg text-foreground/60 hover:text-foreground/80 hover:no-underline">
                                  <div className="flex items-center gap-4"><Info className="w-5 h-5"/>Om Oss</div>
                              </AccordionTrigger>
                              <AccordionContent className="pl-4 space-y-4">
                                  <MobileNavLink href="/about#visjon"><Eye className="w-5 h-5"/>Vår Visjon</MobileNavLink>
                                  <MobileNavLink href="/about#styret"><Users className="w-5 h-5"/>Styret</MobileNavLink>
                                  <MobileNavLink href="/presse"><Briefcase className="w-5 h-5"/>Presse</MobileNavLink>
                              </AccordionContent>
                          </AccordionItem>
                          <div className="py-4">
                              <MobileNavLink href="/tips-oss"><Lightbulb className="w-5 h-5"/>Tips Oss</MobileNavLink>
                          </div>
                          <div className="py-4">
                              <MobileNavLink href="/#contact"><Mail className="w-5 h-5"/>Kontakt</MobileNavLink>
                          </div>
                    </Accordion>
                  </nav>
                  <div className="mt-8">
                    {user ? (
                      <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Avatar>
                                {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User'} />}
                                <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="font-semibold">{user.displayName}</span>
                                <span className="text-sm text-muted-foreground">{user.email}</span>
                            </div>
                          </div>
                          {hasDashboardAccess && !isDeactivated && (
                              <Button asChild className="w-full">
                                  <Link href="/dashboard">
                                      <LayoutDashboard className="mr-2 h-4 w-4" />
                                      <span>Styrepanelet</span>
                                  </Link>
                              </Button>
                          )}
                          <Button asChild className="w-full" variant="outline">
                              <Link href={avatarLink}>
                                  <UserIcon className="mr-2 h-4 w-4" />
                                  <span>Min Profil</span>
                              </Link>
                          </Button>
                          <Button variant="outline" onClick={handleLogout} className="w-full">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Logg ut</span>
                          </Button>
                      </div>
                    ) : (
                      <Button onClick={() => { setIsSheetOpen(false); openAuthDialog(); }} className="w-full">
                          <UserIcon className="mr-2 h-4 w-4"/>
                          Logg inn / Bli medlem
                      </Button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
      <SearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  );
}
