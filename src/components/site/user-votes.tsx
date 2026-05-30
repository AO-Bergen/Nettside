
"use client";

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase/index';
import { collection, doc, getDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2, ThumbsUp } from 'lucide-react';

type Building = {
    id: string;
    name: string;
    slug?: string;
};

type Vote = {
    voteType: string;
    voteValue: number;
};

type VoteDoc = {
    id: string;
    votes: {
        [userId: string]: Vote;
    }
};

type UserVote = {
    buildingId: string;
    buildingName: string;
    buildingSlug?: string;
    voteLabel: string;
};

const voteLabels: Record<string, string> = {
    'ExceptionallyUgly': 'Usedvanlig Stygt',
    'Ugly': 'Stygt',
    'OK Minus': 'OK Minus',
    'OK': 'OK',
    'OK Plus': 'OK Pluss',
    'Beautiful': 'Vakkert',
    'ExceptionallyBeautiful': 'Usedvanlig Vakkert',
};

export function UserVotes({ userId }: { userId: string }) {
    const firestore = useFirestore();
    const [userVotes, setUserVotes] = useState<UserVote[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const votesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'architecturalProjectVotes') : null, [firestore]);
    const { data: allVotesData } = useCollection<VoteDoc>(votesQuery);

    useEffect(() => {
        const fetchUserVotes = async () => {
            if (!allVotesData || !firestore) return;

            setIsLoading(true);
            const votes: UserVote[] = [];

            for (const voteDoc of allVotesData) {
                if (voteDoc.votes && voteDoc.votes[userId]) {
                    const userVoteData = voteDoc.votes[userId];
                    const buildingId = voteDoc.id;

                    const buildingDocRef = doc(firestore, 'projects', buildingId);
                    const buildingSnap = await getDoc(buildingDocRef);

                    if (buildingSnap.exists()) {
                        const buildingData = buildingSnap.data() as Building;
                        votes.push({
                            buildingId: buildingId,
                            buildingName: buildingData.name,
                            buildingSlug: buildingData.slug,
                            voteLabel: voteLabels[userVoteData.voteType] || userVoteData.voteType,
                        });
                    }
                }
            }
            setUserVotes(votes);
            setIsLoading(false);
        };

        fetchUserVotes();
    }, [allVotesData, userId, firestore]);

    return (
        <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center gap-2">
                    <ThumbsUp />
                    Dine Stemmer
                </CardTitle>
                <CardDescription>
                    En oversikt over bygningene du har stemt på.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : userVotes.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bygning</TableHead>
                                    <TableHead>Din Stemme</TableHead>
                                    <TableHead className="text-right">Handling</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {userVotes.map((vote) => (
                                    <TableRow key={vote.buildingId}>
                                        <TableCell className="font-medium">{vote.buildingName}</TableCell>
                                        <TableCell>{vote.voteLabel}</TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild variant="outline" size="sm">
                                                <Link href={`/buildings/${vote.buildingSlug || vote.buildingId}`}>
                                                    Endre stemme
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>Du har ikke stemt på noen bygninger enda.</p>
                        <Button asChild variant="link" className="mt-2">
                            <Link href="/buildings">Se bygningsdatabasen</Link>
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
