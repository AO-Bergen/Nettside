
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function GoogleDrivePage() {
    const driveFolderId = "1FynX2ftlSoB9YnimLEVkGErYfet5wIgu";
    const embedUrl = `https://drive.google.com/embeddedfolderview?id=${driveFolderId}#list`;

    return (
        <div className="flex flex-col flex-grow h-full">
            <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertTitle>Google Drive Integrasjon</AlertTitle>
                <AlertDescription>
                    Denne siden viser innholdet i en delt Google Drive-mappe. Du må kanskje logge inn med Google-kontoen din for å se filene hvis du ikke allerede er det.
                </AlertDescription>
            </Alert>
            <Card className="flex-grow flex flex-col">
                <CardHeader>
                    <CardTitle>Fellesressurser</CardTitle>
                    <CardDescription>Bla gjennom og åpne filer direkte fra den delte mappen.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow p-0 dark:bg-white">
                    <iframe
                        src={embedUrl}
                        className="w-full h-full border-0"
                        allow="fullscreen"
                    ></iframe>
                </CardContent>
            </Card>
        </div>
    );
}
