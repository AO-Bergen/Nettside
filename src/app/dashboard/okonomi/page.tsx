
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle } from "lucide-react";
import { useAuth, useFirestore } from "@/firebase/index";

export default function OkonomiPage() {
    const firestore = useFirestore();
    const { user } = useAuth();
    // states for budgets, expenses, dialogs etc. will go here

    return (
        <Tabs defaultValue="budsjetter" className="w-full">
            <div className="flex items-center justify-between mb-4">
                <TabsList>
                    <TabsTrigger value="budsjetter">Budsjetter</TabsTrigger>
                    <TabsTrigger value="utlegg">Utlegg</TabsTrigger>
                </TabsList>
                <div className="flex gap-2">
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nytt Utlegg
                    </Button>
                     <Button variant="outline">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nytt Budsjett
                    </Button>
                </div>
            </div>
            <TabsContent value="budsjetter">
                <Card>
                    <CardHeader>
                        <CardTitle>Budsjettoversikt</CardTitle>
                        <CardDescription>En oversikt over alle budsjetter for organisasjonen.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-muted-foreground py-8">
                            Funksjonalitet for budsjetter er under utvikling.
                        </p>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="utlegg">
                 <Card>
                    <CardHeader>
                        <CardTitle>Utleggsoversikt</CardTitle>
                        <CardDescription>En oversikt over alle innsendte utlegg.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-muted-foreground py-8">
                           Funksjonalitet for utlegg er under utvikling.
                        </p>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
