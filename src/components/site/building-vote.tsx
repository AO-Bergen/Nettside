
"use client";

import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// Dynamically import the client-only component with ssr disabled
const BuildingVoteClient = dynamic(
  () => import('./building-vote-client').then(mod => mod.BuildingVoteClient),
  { 
    ssr: false,
    loading: () => (
        <Card className="my-8">
            <CardContent className="pt-6 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                <p className="mt-2 text-sm">Laster stemmemodul...</p>
            </CardContent>
        </Card>
    )
  }
);

export function BuildingVote({ buildingId }: { buildingId: string; }) {
  return <BuildingVoteClient buildingId={buildingId} />;
}
