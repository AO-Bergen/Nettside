
"use client";

import React, { useEffect, useState } from 'react';
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { 
  DEFAULT_THEME, 
  DEFAULT_LIGHT_BACKGROUND,
  DEFAULT_LIGHT_PRIMARY,
  DEFAULT_LIGHT_ACCENT,
  DEFAULT_DARK_BACKGROUND,
  DEFAULT_DARK_PRIMARY,
  DEFAULT_DARK_ACCENT,
} from "@/lib/constants";
import { AuthDialog } from '@/components/site/auth-dialog';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseProvider } from '@/firebase/index';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { Loader2 } from 'lucide-react';

type SiteSettings = {
  theme: string;
  colors: {
    light: { background: string; primary: string; accent: string };
    dark: { background: string; primary: string; accent: string };
  }
}

const defaultSettings: SiteSettings = {
  theme: DEFAULT_THEME,
  colors: {
    light: { background: DEFAULT_LIGHT_BACKGROUND, primary: DEFAULT_LIGHT_PRIMARY, accent: DEFAULT_LIGHT_ACCENT },
    dark: { background: DEFAULT_DARK_BACKGROUND, primary: DEFAULT_DARK_PRIMARY, accent: DEFAULT_DARK_ACCENT },
  }
}


export function AppProviders({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    async function fetchSettingsAndApplyTheme() {
      try {
        const db = getFirestore();
        const docRef = doc(db, "settings", "siteConfig");
        const docSnap = await getDoc(docRef);
        let activeSettings = defaultSettings;
        if (docSnap.exists()) {
          const data = docSnap.data();
          activeSettings = {
            theme: data.theme || DEFAULT_THEME,
            colors: data.colors || defaultSettings.colors,
          };
        }
        setSettings(activeSettings);

        const storedTheme = localStorage.getItem('theme');
        const themeToApply = storedTheme || activeSettings.theme;
        document.documentElement.classList.toggle('dark', themeToApply === 'dark');

      } catch (error) {
        console.error("Could not fetch site settings, using defaults.", error)
        const storedTheme = localStorage.getItem('theme');
        const themeToApply = storedTheme || defaultSettings.theme;
        document.documentElement.classList.toggle('dark', themeToApply === 'dark');
      }
      setIsMounted(true);
    }
    fetchSettingsAndApplyTheme();
  }, []);

  if (!isMounted) {
    // Show a basic loading state to avoid flash of unstyled content
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const customColorStyles = `
    :root {
      --background: ${settings.colors.light.background};
      --primary: ${settings.colors.light.primary};
      --accent: ${settings.colors.light.accent};
    }
    .dark {
      --background: ${settings.colors.dark.background};
      --primary: ${settings.colors.dark.primary};
      --accent: ${settings.colors.dark.accent};
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: customColorStyles }} />
      <FirebaseProvider>
        <AuthProvider>
          {children}
          <AuthDialog />
          <Toaster />
        </AuthProvider>
      </FirebaseProvider>
    </>
  );
}
