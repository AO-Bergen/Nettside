
"use client";

import { useState, useEffect } from 'react';
import { useAuth, useFirestore } from '@/firebase/index';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { AnimatePresence, motion } from "framer-motion";
import React from 'react';

export type VoteOptionValue = 'ExceptionallyUgly' | 'Ugly' | 'OK Minus' | 'OK' | 'OK Plus' | 'Beautiful' | 'ExceptionallyBeautiful';

type VoteOption = {
  value: VoteOptionValue;
  label: string;
  description: string[];
};

const voteOptions: VoteOption[] = [
    { 
    value: 'ExceptionallyUgly', 
    label: 'Usedvanlig stygt',
    description: [
      '– Et overgrep mot øyet.',
      '– Jeg ville unngått å se på det om jeg kunne.',
      '– Ødelegger omgivelsene rundt seg.',
      '– Et bygg som får deg til å lure på hvem som godkjente tegningene.'
    ]
  },
  { 
    value: 'Ugly', 
    label: 'Stygt',
    description: [
      '– Jeg ville helst ikke sett på det hver dag.',
      '– Hadde jeg bodd der, ville jeg irritert meg.',
      '– Det trekker ned området.',
      '– Skjemmende i bybildet.'
    ]
  },
  { 
    value: 'OK Minus', 
    label: 'OK minus',
    description: [
      '– Ikke direkte stygt, men mangler sjel.',
      '– Jeg kunne bodd der om jeg måtte, men uten glede.',
      '– Et bygg som prøver, men feiler på proporsjon, farge eller materiale.',
      '– Jeg ser det, og tenker: ja, ja – det får gå.'
    ]
  },
  { 
    value: 'OK', 
    label: 'OK',
    description: [
        '– Helt greit.',
        '– Kunne bodd der, kunne sett på det – uten sterke følelser.',
        '– Verken vakkert eller stygt, bare... der.',
        '– Et nøytralt innslag i bybildet: verken plagsomt eller prisverdig.'
    ]
  },
  { 
    value: 'OK Plus', 
    label: 'OK pluss',
    description: [
        '– Noe ved det fungerer.',
        '– Jeg legger merke til enkelte gode detaljer eller materialvalg.',
        '– Jeg kunne bodd der med et snev av tilfredshet.',
        '– Et bygg som kanskje ikke imponerer, men gjør seg fint i hverdagen.'
    ]
  },
  { 
    value: 'Beautiful', 
    label: 'Vakkert',
    description: [
        '– Jeg ville gjerne bodd der.',
        '– Å se det i nabolaget ville gitt meg glede.',
        '– Det tilfører stedet harmoni, verdighet eller karakter.',
        '– Et bygg du blir litt stolt av, selv bare som nabo.'
    ]
  },
  { 
    value: 'ExceptionallyBeautiful', 
    label: 'Usedvanlig vakkert',
    description: [
      '– Et mesterverk.',
      '– Jeg ville gått en omvei bare for å se det.',
      '– Et bygg som løfter sjelen, som gjør byen vakrere bare ved å finnes.',
      '– Du ville vært stolt av å bo der, og takknemlig for å ha det i nærheten.'
    ]
  },
];

const voteValues: Record<VoteOptionValue, number> = {
    'ExceptionallyUgly': 0,
    'Ugly': 1,
    'OK Minus': 2,
    'OK': 3,
    'OK Plus': 4,
    'Beautiful': 5,
    'ExceptionallyBeautiful': 6,
};

type UserVote = {
  voteType: VoteOptionValue;
  voteValue: number;
};

export type ProjectVotesDoc = {
    votes: {
        [userId: string]: UserVote;
    }
};

function VoteResultsDisplay({ voteData, currentUserVote }: { voteData: ProjectVotesDoc | null, currentUserVote: VoteOptionValue | null }) {
    if (!voteData || !voteData.votes) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-6 w-6 animate-spin"/></div>
    }

    const voteEntries = Object.values(voteData.votes);
    const totalVotes = voteEntries.length;

    const distribution = voteOptions.reduce((acc, option) => {
        acc[option.value] = 0;
        return acc;
    }, {} as Record<VoteOptionValue, number>);

    voteEntries.forEach(vote => {
        if (vote.voteType in distribution) {
            distribution[vote.voteType]++;
        }
    });

    if (totalVotes === 0) {
        return <p className="text-center text-muted-foreground p-4">Ingen stemmer er avgitt for dette bygget enda.</p>
    }

    return (
        <div className="space-y-4">
            <h4 className="font-semibold text-center">{totalVotes} stemme{totalVotes !== 1 ? 'r' : ''} totalt</h4>
             <div className="space-y-2">
                {voteOptions.map(option => {
                    const count = distribution[option.value];
                    const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
                    const isUserCurrentVote = currentUserVote === option.value;

                    return (
                        <div 
                            key={option.value} 
                            className={cn(
                                "relative h-10 w-full rounded-lg overflow-hidden bg-secondary border border-transparent",
                                isUserCurrentVote && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            )}
                        >
                            <motion.div
                                className="h-full bg-primary"
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.5, ease: "easeInOut" }}
                            />
                            <div className="absolute inset-0 flex items-center justify-between px-3 text-white">
                                <span className="font-medium mix-blend-difference">{option.label}</span>
                                <span className="font-mono text-sm font-medium mix-blend-difference">{percentage.toFixed(0)}%</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function BuildingVoteClient({ buildingId }: { buildingId: string; }) {
  const { user, loading: userLoading, openAuthDialog } = useAuth();
  const firestore = useFirestore();
  const [selectedVote, setSelectedVote] = useState<VoteOptionValue | null>(null);
  const [projectVotes, setProjectVotes] = useState<ProjectVotesDoc | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const { toast } = useToast();

  const currentUserVote = user && projectVotes && projectVotes.votes && projectVotes.votes[user.uid] ? projectVotes.votes[user.uid].voteType : null;

  useEffect(() => {
    if (!firestore) return;
    const voteDocRef = doc(firestore, 'architecturalProjectVotes', buildingId);
    const unsubscribe = onSnapshot(voteDocRef, (snapshot) => {
      if (snapshot.exists()) {
        setProjectVotes(snapshot.data() as ProjectVotesDoc);
      } else {
        setProjectVotes({ votes: {} }); 
      }
    });

    return () => unsubscribe();
  }, [buildingId, firestore]);
  
  useEffect(() => {
    if (currentUserVote) {
      setSelectedVote(currentUserVote);
    } else {
      setSelectedVote(null);
    }
  }, [currentUserVote]);

  const handleVoteSubmit = async () => {
    if (!user) {
      if (openAuthDialog) openAuthDialog();
      return;
    }
    if (!selectedVote) {
      toast({ title: 'Vennligst velg et alternativ', variant: 'destructive' });
      return;
    }
    if (!firestore) return;

    setIsSubmitting(true);
    
    const voteDocRef = doc(firestore, "architecturalProjectVotes", buildingId);
    const votePayload = {
      votes: {
        [user.uid]: {
          voteType: selectedVote,
          voteValue: voteValues[selectedVote],
          voteDate: serverTimestamp(),
        }
      }
    };

    try {
      await setDoc(voteDocRef, votePayload, { merge: true });
      toast({
        title: 'Takk for din stemme!',
        description: `Din stemme er ${currentUserVote ? 'oppdatert' : 'registrert'}.`,
      });
      setIsVoting(false);
    } catch (serverError: any) {
        console.error("Vote submission error:", serverError);
        toast({ title: "Stemme feilet", description: "Kunne ikke lagre stemmen din.", variant: "destructive"});
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const selectedVoteDetails = voteOptions.find(o => o.value === selectedVote);

  if (userLoading) {
    return (
        <Card className="my-8">
            <CardContent className="pt-6 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            </CardContent>
        </Card>
    );
  }

  if (isVoting) {
    return (
        <Card className="my-8">
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center gap-2"><ThumbsUp/>Hva synes du?</CardTitle>
            <CardDescription>Velg det alternativet som passer best for deg.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup value={selectedVote || ''} onValueChange={(value) => setSelectedVote(value as VoteOptionValue)} className="grid grid-cols-1 md:grid-cols-7 gap-2">
                {voteOptions.map((option) => (
                    <div key={option.value}>
                        <RadioGroupItem value={option.value} id={option.value} className="peer sr-only" />
                        <Label
                            htmlFor={option.value}
                            className={cn(
                            'flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary',
                            'cursor-pointer transition-colors h-full'
                            )}
                        >
                            {option.label}
                        </Label>
                    </div>
                ))}
            </RadioGroup>

            <AnimatePresence>
                {selectedVoteDetails && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 bg-muted/50 rounded-lg border">
                            <h4 className="font-semibold mb-2 text-lg">{selectedVoteDetails.label}</h4>
                            <ul className="space-y-1 text-muted-foreground list-none p-0">
                                {selectedVoteDetails.description.map((line, index) => (
                                    <li key={index}>{line}</li>
                                ))}
                            </ul>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleVoteSubmit} disabled={isSubmitting || !selectedVote} className="w-full sm:flex-grow">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {currentUserVote ? 'Oppdater stemme' : 'Avgi stemme'}
              </Button>
              <Button variant="outline" onClick={() => setIsVoting(false)} className="w-full sm:w-auto">
                  Avbryt
              </Button>
            </div>
          </CardContent>
        </Card>
    );
  }

  return (
    <Card className="my-8">
        <CardHeader>
            <CardTitle className="font-headline text-2xl">Resultater</CardTitle>
            <CardDescription>
                {user ? (currentUserVote ? "Takk for din stemme!" : "Se hva andre mener om bygget.") : "Se hva andre mener om bygget. Logg inn for å avgi din stemme."}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <VoteResultsDisplay voteData={projectVotes} currentUserVote={currentUserVote} />
            <div className="text-center mt-6">
                {user ? (
                    <Button onClick={() => setIsVoting(true)} className="w-full sm:w-auto">
                        {currentUserVote ? 'Endre din stemme' : 'Avgi din stemme'}
                    </Button>
                ) : (
                    <Button onClick={openAuthDialog} className="w-full sm:w-auto">
                        Logg inn for å stemme
                    </Button>
                )}
            </div>
        </CardContent>
    </Card>
  );
}
