
"use client";

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import type { Building } from '@/types/building';

const MapComponent = dynamic(() => import('@/components/site/map-component'), { 
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
});

export function BuildingMap({ building }: { building: Building }) {
    return <MapComponent buildings={[building]} />;
}
