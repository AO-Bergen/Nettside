'use client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Lock } from 'lucide-react';

interface ReadOnlyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReadOnlyDialog({ isOpen, onOpenChange }: ReadOnlyDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock />
            Kun Lesetilgang
          </AlertDialogTitle>
          <AlertDialogDescription>
            Du har ikke tillatelse til å utføre denne handlingen. Denne siden er i skrivebeskyttet modus for din bruker.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>Ok, jeg forstår</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
