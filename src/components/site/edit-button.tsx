
"use client";

import { useAuth, useFirestore } from "@/firebase/index";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit } from "lucide-react";

const ALLOWED_ROLES = ["Administrator", "Styremedlem"];

export function EditButton({ editUrl }: { editUrl: string }) {
    const { user, loading } = useAuth();
    const firestore = useFirestore();
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        if (user && firestore) {
            const userDocRef = doc(firestore, "users", user.uid);
            getDoc(userDocRef).then(userDocSnap => {
                if (userDocSnap.exists()) {
                    setUserRole(userDocSnap.data().role);
                }
            });
        } else {
            setUserRole(null);
        }
    }, [user, firestore]);

    if (loading || !user || !userRole || !ALLOWED_ROLES.includes(userRole)) {
        return null;
    }

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <Button asChild size="lg" className="rounded-full shadow-lg">
                <Link href={editUrl}>
                    <Edit className="mr-2 h-5 w-5" />
                    Rediger
                </Link>
            </Button>
        </div>
    );
}
