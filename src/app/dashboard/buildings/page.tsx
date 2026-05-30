

"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, FolderOpen, Trash2, MapPin, Info, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFirestore } from "@/firebase/index";
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, QueryDocumentSnapshot, DocumentData, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import Image from "next/image";
import { FileExplorer, SelectedFile } from "@/components/site/file-explorer";
import { cn } from "@/lib/utils";
import { MarkdownEditor } from "@/components/site/markdown-editor";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const statuses = ["Kladd", "Planlegging", "Ferdigstilt", "Bevare", "Avvist"];

const verneklasser = [
    { id: 'fredet', name: 'Fredet' },
    { id: 'verneverdig', name: 'Verneverdig' },
    { id: 'bevaringsverdig', name: 'Bevaringsverdig' },
    { id: 'automatisk_fredet', name: 'Automatisk fredet' },
    { id: 'ikke_vurdert', name: 'Ikke vurdert / ukjent' },
];

const demolitionReasons = [
    "Bombet under 2. verdenskrig",
    "Brant ned",
    "Revet for å gjøre plass til nytt bygg",
    "Ukjent"
];

const stylesWithOptions = [
    {
      category: "Antikken",
      styles: [
        { name: "Egyptisk arkitektur", subStyles: [] },
        { name: "Gresk arkitektur", subStyles: ["Dorisk", "Jonisk", "Korintisk"] },
        { name: "Romersk arkitektur", subStyles: [] },
      ],
    },
    {
      category: "Middelalder",
      styles: [
        { name: "Romansk stil", subStyles: ["Lombardisk", "Normannisk", "Anglo-normannisk"] },
        { name: "Gotisk stil", subStyles: ["Tidlig gotikk", "Høygotikk", "Sengotikk", "Engelsk perpendikulær", "Skandinavisk teglgotikk"] },
      ],
    },
    {
      category: "Renessanse og barokk",
      styles: [
        { name: "Renessanse", subStyles: ["Tidlig renessanse", "Høyrenessanse", "Nordisk renessanse"] },
        { name: "Manierisme", subStyles: [] },
        { name: "Barokk", subStyles: ["Høybarokk", "Nordisk barokk"] },
        { name: "Rokokko", subStyles: [] },
      ],
    },
    {
      category: "Opplysningstid og klassisisme",
      styles: [
        { name: "Nyklassisisme", subStyles: ["Empire", "Palladianisme", "Louis-sekstende"] },
        { name: "Empirestil", subStyles: [] },
      ],
    },
    {
      category: "1800-tallets historisme og romantikk",
      styles: [
        { name: "Nygotikk", subStyles: [] },
        { name: "Nyrenessanse", subStyles: [] },
        { name: "Sveitserstil", subStyles: [] },
        { name: "Dragestil", subStyles: [] },
        { name: "Historistisk rundbuestil", subStyles: [] },
      ],
    },
    {
      category: "Moderne epoker",
      styles: [
        { name: "Jugend / Art Nouveau", subStyles: [] },
        { name: "Nyklassisisme (mellomkrigstiden)", subStyles: [] },
        { name: "Funksjonalisme / Modernisme", subStyles: ["Bauhaus", "Internasjonal stil", "Skandinavisk modernisme"] },
        { name: "Brutalisme", subStyles: [] },
        { name: "Postmodernisme", subStyles: [] },
      ],
    },
    {
      category: "Samtid og nyere retninger",
      styles: [
        { name: "Deconstructivism", subStyles: [] },
        { name: "High-tech-arkitektur", subStyles: [] },
        { name: "Minimalisme", subStyles: [] },
        { name: "Økoarkitektur / Bærekraftig arkitektur", subStyles: [] },
        { name: "Nytradisjonalisme", subStyles: [] },
      ],
    },
];

type Building = { 
  id: string; 
  name: string; 
  slug?: string;
  address: string; 
  status: string; 
  epoch?: string;
  style?: string;
  subStyle?: string;
  owner?: string;
  arkitekt?: string;
  verneklasse?: string;
  imageUrls?: string[];
  imageAttributions?: string[];
  constructionYear?: number;
  completionYear?: number;
  description?: string;
  latitude?: number;
  longitude?: number;

  previouslyExisted?: boolean;
  previousName?: string;
  previousImageUrl?: string;
  previousImageAttribution?: string;
  previousArchitect?: string;
  previousConstructionYear?: number;
  previousDemolitionYear?: number;
  demolitionReason?: string;
  previousInfoUrl?: string;
};

const emptyBuildingState: Omit<Building, 'id'> = {
    name: '', address: '', status: 'Kladd', epoch: '', style: '', subStyle: '', owner: '', arkitekt: '', verneklasse: 'ikke_vurdert', imageUrls: [], imageAttributions: [], constructionYear: undefined, completionYear: undefined, slug: '', description: '', latitude: undefined, longitude: undefined,
    previouslyExisted: false, previousName: '', previousImageUrl: '', previousImageAttribution: '', previousArchitect: '', previousConstructionYear: undefined, previousDemolitionYear: undefined, demolitionReason: '', previousInfoUrl: ''
}

const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')        // Replace spaces with -
      .replace(/[^\w\-]+/g, '')   // Remove all non-word chars
      .replace(/\-\-+/g, '-')      // Replace multiple - with single -
      .replace(/^-+/, '')           // Trim - from start of text
      .replace(/-+$/, '');          // Trim - from end of text
};

const NONE_VALUE = "__NONE__";

export default function BuildingsPage() {
  const firestore = useFirestore();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [imageTarget, setImageTarget] = useState<'main' | 'previous' | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [newBuilding, setNewBuilding] = useState<Omit<Building, 'id'>>(emptyBuildingState);
  const [showDescriptionEditor, setShowDescriptionEditor] = useState(false);
  const { toast } = useToast();
  
  const [availableStyles, setAvailableStyles] = useState<{name: string; subStyles: string[]}[]>([]);
  const [availableSubStyles, setAvailableSubStyles] = useState<string[]>([]);
  
  const [availableStylesForEdit, setAvailableStylesForEdit] = useState<{name: string; subStyles: string[]}[]>([]);
  const [availableSubStylesForEdit, setAvailableSubStylesForEdit] = useState<string[]>([]);

  const searchParams = useSearchParams();

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "projects"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const buildingsData: Building[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        buildingsData.push({ id: doc.id, ...doc.data() } as Building);
      });
      setBuildings(buildingsData);

       const editId = searchParams.get('edit');
      if (editId) {
        const buildingToEdit = buildingsData.find(b => b.id === editId);
        if (buildingToEdit) {
            openEditDialog(buildingToEdit);
        }
      }
    }, (error) => {
        const permissionError = new FirestorePermissionError({
            path: collection(firestore, "projects").path,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [firestore, searchParams]);
  
  const handleFileSelect = (files: SelectedFile[]) => {
    if (!files.length) {
        setIsFileExplorerOpen(false);
        setImageTarget(null);
        return;
    }

    const updater = selectedBuilding ? setSelectedBuilding : setNewBuilding;

    if (imageTarget === 'main') {
        const newUrls = files.map(f => f.url);
        const newAttributions = files.map(f => f.attribution || '');
        updater((prev: any) => ({
            ...prev,
            imageUrls: [...(prev.imageUrls || []), ...newUrls],
            imageAttributions: [...(prev.imageAttributions || []), ...newAttributions]
        }));
    } else if (imageTarget === 'previous') {
        updater((prev: any) => ({
            ...prev,
            previousImageUrl: files[0].url,
            previousImageAttribution: prev.previousImageAttribution || files[0].attribution || ''
        }));
    }
    
    setIsFileExplorerOpen(false);
    setImageTarget(null);
  }

  const handleImageAttributionChange = (index: number, value: string) => {
    const updater = selectedBuilding ? setSelectedBuilding : setNewBuilding;
    updater((prev: any) => {
        const newAttributions = [...(prev.imageAttributions || [])];
        newAttributions[index] = value;
        return {...prev, imageAttributions: newAttributions };
    });
  }

  const handleRemoveImage = (indexToRemove: number) => {
    const updater = selectedBuilding ? setSelectedBuilding : setNewBuilding;
    updater((prev: any) => ({
        ...prev,
        imageUrls: (prev.imageUrls || []).filter((_: any, index: number) => index !== indexToRemove),
        imageAttributions: (prev.imageAttributions || []).filter((_: any, index: number) => index !== indexToRemove),
    }));
  }

  const handleImageSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    
    const updater = selectedBuilding ? setSelectedBuilding : setNewBuilding;
    updater((prev: any) => {
        const newUrls = [...(prev.imageUrls || [])];
        const newAttributions = [...(prev.imageAttributions || [])];

        const draggedUrl = newUrls.splice(dragItem.current!, 1)[0];
        const draggedAttr = newAttributions.splice(dragItem.current!, 1)[0];

        newUrls.splice(dragOverItem.current!, 0, draggedUrl);
        newAttributions.splice(dragOverItem.current!, 0, draggedAttr);

        return { ...prev, imageUrls: newUrls, imageAttributions: newAttributions };
    });

    dragItem.current = null;
    dragOverItem.current = null;
  }

  const geocodeAddress = async (address: string) => {
    if (!address) return null;
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&addressdetails=1&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon),
            };
        }
        return null;
    } catch (error) {
        console.error("Geocoding error:", error);
        toast({ title: "Geocoding feilet", description: "Kunne ikke finne koordinater for adressen.", variant: "destructive" });
        return null;
    }
  }

  const handleAddBuilding = async (status: 'Kladd' | 'Ferdigstilt') => {
    if (!firestore) return;
    if (newBuilding.name && newBuilding.address) {
        const coords = await geocodeAddress(newBuilding.address);
        const buildingsCollection = collection(firestore, "projects");
        const dataToSave = {
            ...newBuilding,
            status: status,
            slug: newBuilding.slug || slugify(newBuilding.name),
            constructionYear: newBuilding.constructionYear || null,
            completionYear: newBuilding.completionYear || null,
            description: showDescriptionEditor ? newBuilding.description : '',
            latitude: coords?.latitude || null,
            longitude: coords?.longitude || null,
            previousConstructionYear: newBuilding.previousConstructionYear || null,
            previousDemolitionYear: newBuilding.previousDemolitionYear || null,
        }
        addDoc(buildingsCollection, dataToSave).then(() => {
            setNewBuilding(emptyBuildingState);
            setIsAddDialogOpen(false);
            setAvailableStyles([]);
            setAvailableSubStyles([]);
            setShowDescriptionEditor(false);
            toast({ title: `Bygning ${status === 'Kladd' ? 'lagret som kladd' : 'opprettet'}!` });
        }).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: buildingsCollection.path,
                operation: 'create',
                requestResourceData: dataToSave
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }
  };

  const handleUpdateBuilding = async () => {
    if (!firestore) return;
    if (selectedBuilding && selectedBuilding.id) {
      const coords = await geocodeAddress(selectedBuilding.address);
      const buildingDoc = doc(firestore, "projects", selectedBuilding.id);
      const { id, ...buildingData } = selectedBuilding;
      const dataToSave = {
        ...buildingData,
        slug: selectedBuilding.slug || slugify(selectedBuilding.name),
        constructionYear: buildingData.constructionYear || null,
        completionYear: buildingData.completionYear || null,
        description: showDescriptionEditor ? selectedBuilding.description : buildingData.description || '',
        latitude: coords?.latitude || selectedBuilding.latitude || null,
        longitude: coords?.longitude || selectedBuilding.longitude || null,
        previousConstructionYear: buildingData.previousConstructionYear || null,
        previousDemolitionYear: buildingData.previousDemolitionYear || null,
      }
      updateDoc(buildingDoc, dataToSave).then(() => {
          setSelectedBuilding(null);
          setIsEditDialogOpen(false);
          setAvailableStylesForEdit([]);
          setAvailableSubStylesForEdit([]);
          setShowDescriptionEditor(false);
          toast({ title: "Bygning oppdatert!" });
      }).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: buildingDoc.path,
            operation: 'update',
            requestResourceData: dataToSave
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    }
  };

  const handleDeleteBuilding = async (buildingId: string) => {
    if (!firestore) return;
    if (window.confirm("Er du sikker på at du vil slette denne bygningen?")) {
        const buildingDoc = doc(firestore, "projects", buildingId);
        deleteDoc(buildingDoc).then(() => {
            toast({ title: "Bygning slettet." });
        }).catch((serverError) => {
            const permissionError = new FirestorePermissionError({
                path: buildingDoc.path,
                operation: 'delete'
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }
  };

  const openEditDialog = (building: Building) => {
    setSelectedBuilding({ ...building });
    const selectedEpoch = stylesWithOptions.find(e => e.category === building.epoch);
    if(selectedEpoch) {
      setAvailableStylesForEdit(selectedEpoch.styles);
      const selectedStyle = selectedEpoch.styles.find(s => s.name === building.style);
      setAvailableSubStylesForEdit(selectedStyle?.subStyles || []);
    }
    if (building.description) {
        setShowDescriptionEditor(true);
    }
    setIsEditDialogOpen(true);
  };
  
    const handleEpochChange = (epochName: string, isEditMode: boolean) => {
        const epoch = stylesWithOptions.find(e => e.category === epochName);
        const styles = epoch?.styles || [];
        const epochValue = epochName === NONE_VALUE ? '' : epochName;

        if(isEditMode) {
            setSelectedBuilding(prev => prev ? { ...prev, epoch: epochValue, style: '', subStyle: '' } : null);
            setAvailableStylesForEdit(styles);
            setAvailableSubStylesForEdit([]);
        } else {
            setNewBuilding(prev => ({...prev, epoch: epochValue, style: '', subStyle: '' }));
            setAvailableStyles(styles);
            setAvailableSubStyles([]);
        }
    }

    const handleStyleChange = (styleName: string, isEditMode: boolean) => {
        const styleSource = isEditMode ? availableStylesForEdit : availableStyles;
        const style = styleSource.find(s => s.name === styleName);
        const subStyles = style?.subStyles || [];
        const styleValue = styleName === NONE_VALUE ? '' : styleName;
        if(isEditMode) {
            setSelectedBuilding(prev => prev ? { ...prev, style: styleValue, subStyle: '' } : null);
            setAvailableSubStylesForEdit(subStyles);
        } else {
            setNewBuilding(prev => ({...prev, style: styleValue, subStyle: '' }));
            setAvailableSubStyles(subStyles);
        }
    }

    const handleSubStyleChange = (subStyleName: string, isEditMode: boolean) => {
        const subStyleValue = subStyleName === NONE_VALUE ? '' : subStyleName;
        if(isEditMode) {
            setSelectedBuilding(prev => prev ? { ...prev, subStyle: subStyleValue } : null);
        } else {
            setNewBuilding(prev => ({...prev, subStyle: subStyleValue }));
        }
    }


  return (
    <>
    <Card>
      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
            <CardTitle>Arkitektoniske Bygninger</CardTitle>
            <CardDescription>Database over arkitektoniske bygninger i Bergen.</CardDescription>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(isOpen) => { setIsAddDialogOpen(isOpen); if(!isOpen) { setAvailableStyles([]); setAvailableSubStyles([]); setShowDescriptionEditor(false); } }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 w-full md:w-auto">
              <PlusCircle className="h-4 w-4" />
              Ny Bygning
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Legg til ny bygning</DialogTitle>
              <DialogDescription>
                  Fyll ut informasjonen for den nye bygningen. Du kan lagre som kladd eller publisere direkte.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                <div className="grid gap-4 py-4 pr-2">
                    <div className="space-y-2">
                        <Label>Bilder (første bilde er hovedbilde)</Label>
                        <div className="space-y-2">
                            {(newBuilding.imageUrls || []).map((url, index) => (
                                <div 
                                    key={index}
                                    className="flex items-center gap-2 p-2 border rounded-md"
                                    draggable
                                    onDragStart={() => dragItem.current = index}
                                    onDragEnter={() => dragOverItem.current = index}
                                    onDragEnd={handleImageSort}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <GripVertical className="cursor-grab text-muted-foreground"/>
                                    <Image src={url} alt={`Bilde ${index + 1}`} width={60} height={60} className="rounded-md aspect-square object-cover" />
                                    <Input 
                                        value={(newBuilding.imageAttributions || [])[index] || ''} 
                                        onChange={(e) => handleImageAttributionChange(index, e.target.value)} 
                                        placeholder="Bildekreditering"
                                        className="flex-grow"
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveImage(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" onClick={() => { setIsFileExplorerOpen(true); setImageTarget('main'); }}>
                            <FolderOpen className="mr-2 h-4 w-4"/> Legg til bilde
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="name">Navn</Label>
                        <Input id="name" value={newBuilding.name} onChange={(e) => setNewBuilding({ ...newBuilding, name: e.target.value, slug: slugify(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="slug">URL Slug</Label>
                        <Input id="slug" value={newBuilding.slug || ''} onChange={(e) => setNewBuilding({ ...newBuilding, slug: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">Adresse</Label>
                        <Input id="address" value={newBuilding.address} onChange={(e) => setNewBuilding({ ...newBuilding, address: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="owner">Eier</Label>
                            <Input id="owner" placeholder="Ukjent" value={newBuilding.owner || ''} onChange={(e) => setNewBuilding({ ...newBuilding, owner: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="arkitekt">Arkitekt</Label>
                            <Input id="arkitekt" placeholder="Ukjent" value={newBuilding.arkitekt || ''} onChange={(e) => setNewBuilding({ ...newBuilding, arkitekt: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="constructionYear">Bygningsår</Label>
                            <Input id="constructionYear" type="number" placeholder="Ukjent" value={newBuilding.constructionYear || ''} onChange={(e) => setNewBuilding({ ...newBuilding, constructionYear: Number(e.target.value) || undefined })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="completionYear">Ferdigstilt</Label>
                            <Input id="completionYear" type="number" placeholder="Ukjent" value={newBuilding.completionYear || ''} onChange={(e) => setNewBuilding({ ...newBuilding, completionYear: Number(e.target.value) || undefined })} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="verneklasse">Verneklasse</Label>
                        <Select onValueChange={(value) => setNewBuilding({ ...newBuilding, verneklasse: value })} value={newBuilding.verneklasse}>
                            <SelectTrigger><SelectValue placeholder="Velg verneklasse" /></SelectTrigger>
                            <SelectContent>
                                {verneklasser.map(vk => <SelectItem key={vk.id} value={vk.id}>{vk.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="epoch">Epoke</Label>
                        <Select onValueChange={(value) => handleEpochChange(value, false)} value={newBuilding.epoch}>
                            <SelectTrigger><SelectValue placeholder="Velg epoke" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE_VALUE}>Ikke spesifisert / Ukjent</SelectItem>
                                {stylesWithOptions.map(epoch => (
                                    <SelectItem key={epoch.category} value={epoch.category}>{epoch.category}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {availableStyles.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="style">Stil</Label>
                            <Select onValueChange={(value) => handleStyleChange(value, false)} value={newBuilding.style}>
                                <SelectTrigger><SelectValue placeholder="Velg stil" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE_VALUE}>Ikke spesifisert / Ukjent</SelectItem>
                                    {availableStyles.map(style => (
                                        <SelectItem key={style.name} value={style.name}>{style.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {availableSubStyles.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="subStyle">Understil</Label>
                            <Select onValueChange={(value) => handleSubStyleChange(value, false)} value={newBuilding.subStyle}>
                                <SelectTrigger><SelectValue placeholder="Velg understil" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE_VALUE}>Ikke spesifisert / Ukjent</SelectItem>
                                    {availableSubStyles.map(subStyle => <SelectItem key={subStyle} value={subStyle}>{subStyle}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center space-x-2">
                            <Switch id="previouslyExisted-toggle" checked={newBuilding.previouslyExisted} onCheckedChange={(checked) => setNewBuilding(prev => ({...prev, previouslyExisted: checked }))} />
                            <Label htmlFor="previouslyExisted-toggle">Dokumenter tidligere bygning på tomten</Label>
                        </div>
                        {newBuilding.previouslyExisted && (
                            <div className="p-4 border rounded-md space-y-4 bg-muted/50">
                                <h4 className="font-medium text-center">Tidligere Bygning</h4>
                                <div className="space-y-2">
                                    <Label>Bilde av tidligere bygning</Label>
                                    {newBuilding.previousImageUrl && <Image src={newBuilding.previousImageUrl} alt="Forrige bygning" width={100} height={100} className="rounded-md border" />}
                                    <Button variant="outline" size="sm" onClick={() => { setIsFileExplorerOpen(true); setImageTarget('previous'); }}>
                                        <FolderOpen className="mr-2 h-4 w-4"/> Velg bilde
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    <Label>Bildekreditering (tidligere bygning)</Label>
                                    <Input placeholder="Ukjent" value={newBuilding.previousImageAttribution || ''} onChange={(e) => setNewBuilding({ ...newBuilding, previousImageAttribution: e.target.value })} />
                                </div>
                                 <div className="space-y-2">
                                    <Label>Navn (tidligere bygning)</Label>
                                    <Input placeholder="Ukjent" value={newBuilding.previousName || ''} onChange={(e) => setNewBuilding({ ...newBuilding, previousName: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Arkitekt (tidligere bygning)</Label>
                                    <Input placeholder="Ukjent" value={newBuilding.previousArchitect || ''} onChange={(e) => setNewBuilding({ ...newBuilding, previousArchitect: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Eksisterte fra</Label>
                                        <Input type="number" placeholder="Årstall" value={newBuilding.previousConstructionYear || ''} onChange={(e) => setNewBuilding({ ...newBuilding, previousConstructionYear: Number(e.target.value) || undefined })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Til</Label>
                                        <Input type="number" placeholder="Årstall" value={newBuilding.previousDemolitionYear || ''} onChange={(e) => setNewBuilding({ ...newBuilding, previousDemolitionYear: Number(e.target.value) || undefined })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Begrunnelse for fjerning</Label>
                                    <Select onValueChange={(value) => setNewBuilding({ ...newBuilding, demolitionReason: value })} value={newBuilding.demolitionReason}>
                                        <SelectTrigger><SelectValue placeholder="Velg årsak" /></SelectTrigger>
                                        <SelectContent>
                                            {demolitionReasons.map(reason => <SelectItem key={reason} value={reason}>{reason}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div className="space-y-2">
                                    <Label>Lenke for "les mer"</Label>
                                    <Input placeholder="https://" value={newBuilding.previousInfoUrl || ''} onChange={(e) => setNewBuilding({ ...newBuilding, previousInfoUrl: e.target.value })} />
                                </div>
                            </div>
                        )}
                    </div>

                     <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center space-x-2">
                            <Switch id="description-toggle" checked={showDescriptionEditor} onCheckedChange={setShowDescriptionEditor}/>
                            <Label htmlFor="description-toggle">Legg til beskrivelse</Label>
                        </div>
                        {showDescriptionEditor && (
                            <div className="h-[400px]">
                                <MarkdownEditor 
                                    initialContent={newBuilding.description || ''} 
                                    onContentChange={(content) => setNewBuilding(prev => ({ ...prev, description: content }))} 
                                />
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => handleAddBuilding('Kladd')}>Lagre som kladd</Button>
                <Button type="button" onClick={() => handleAddBuilding('Ferdigstilt')}>Publiser</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {/* Mobile View */}
        <div className="md:hidden space-y-4">
            {buildings.map((building) => (
                <Card key={building.id} className="p-4">
                    <div className="flex gap-4 items-start">
                        {building.imageUrls && building.imageUrls.length > 0 ? (
                            <Image src={building.imageUrls[0]} alt={building.name} width={64} height={64} className="flex-shrink-0 rounded-md object-cover aspect-square" unoptimized />
                        ) : (
                            <div className="flex-shrink-0 w-16 h-16 bg-muted rounded-md" />
                        )}
                        <div className="min-w-0 flex-grow">
                            <h3 className="font-medium">{building.name}</h3>
                            <p className="text-sm text-muted-foreground">{building.address}</p>
                            <Badge variant={building.status === "Kladd" ? "secondary" : "outline"} className="mt-2">{building.status}</Badge>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Handlinger</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEditDialog(building)}>Rediger</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteBuilding(building.id)} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">Slett</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </Card>
            ))}
        </div>
        {/* Desktop View */}
        <div className="w-full overflow-x-auto hidden md:block">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-[64px]">Bilde</TableHead>
                <TableHead>Bygningsnavn</TableHead>
                <TableHead className="hidden md:table-cell">Adresse</TableHead>
                <TableHead>Epoke</TableHead>
                <TableHead>Stil</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead>Koordinater</TableHead>
                <TableHead><span className="sr-only">Handlinger</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {buildings.map((building) => (
                <TableRow key={building.id}>
                    <TableCell>
                        {building.imageUrls && building.imageUrls.length > 0 ? (
                           <Image src={building.imageUrls[0]} alt={building.name} width={64} height={64} className="rounded-md object-cover aspect-square" unoptimized />
                        ) : (
                           <div className="w-16 h-16 bg-muted rounded-md" />
                        )}
                    </TableCell>
                    <TableCell className="font-medium">{building.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{building.address}</TableCell>
                    <TableCell>{building.epoch}</TableCell>
                    <TableCell>
                        {building.style}
                        {building.subStyle && <span className="text-muted-foreground"> - {building.subStyle}</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                        <Badge variant={building.status === "Kladd" ? "secondary" : "outline"}>{building.status}</Badge>
                    </TableCell>
                    <TableCell>
                        {building.latitude && building.longitude ? 
                            <MapPin className="h-5 w-5 text-green-500" /> : 
                            <MapPin className="h-5 w-5 text-muted-foreground" />
                        }
                    </TableCell>
                    <TableCell>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Handlinger</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openEditDialog(building)}>Rediger</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteBuilding(building.id)} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">Slett</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
    {selectedBuilding && (
    <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { setIsEditDialogOpen(isOpen); if(!isOpen) { setAvailableStylesForEdit([]); setAvailableSubStylesForEdit([]); setShowDescriptionEditor(false); }}}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Rediger bygning</DialogTitle>
                <DialogDescription>Endre informasjonen for {selectedBuilding.name}.</DialogDescription>
            </DialogHeader>
             <ScrollArea className="max-h-[70vh] -mx-6 px-6">
                <div className="grid gap-4 py-4 pr-2">
                    <div className="space-y-2">
                        <Label>Bilder (første bilde er hovedbilde)</Label>
                        <div className="space-y-2">
                            {(selectedBuilding.imageUrls || []).map((url, index) => (
                                <div 
                                    key={index}
                                    className="flex items-center gap-2 p-2 border rounded-md"
                                    draggable
                                    onDragStart={() => dragItem.current = index}
                                    onDragEnter={() => dragOverItem.current = index}
                                    onDragEnd={handleImageSort}
                                    onDragOver={(e) => e.preventDefault()}
                                >
                                    <GripVertical className="cursor-grab text-muted-foreground"/>
                                    <Image src={url} alt={`Bilde ${index + 1}`} width={60} height={60} className="rounded-md aspect-square object-cover" />
                                    <Input 
                                        value={(selectedBuilding.imageAttributions || [])[index] || ''} 
                                        onChange={(e) => handleImageAttributionChange(index, e.target.value)} 
                                        placeholder="Bildekreditering"
                                        className="flex-grow"
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveImage(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <Button variant="outline" onClick={() => { setIsFileExplorerOpen(true); setImageTarget('main'); }}>
                            <FolderOpen className="mr-2 h-4 w-4"/> Legg til bilde
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">Navn</Label>
                        <Input id="edit-name" value={selectedBuilding.name} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, name: e.target.value, slug: slugify(e.target.value) })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-slug">URL Slug</Label>
                        <Input id="edit-slug" value={selectedBuilding.slug || ''} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, slug: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-address">Adresse</Label>
                        <Input id="edit-address" value={selectedBuilding.address} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, address: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-owner">Eier</Label>
                            <Input id="edit-owner" placeholder="Ukjent" value={selectedBuilding.owner || ''} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, owner: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-arkitekt">Arkitekt</Label>
                            <Input id="edit-arkitekt" placeholder="Ukjent" value={selectedBuilding.arkitekt || ''} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, arkitekt: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-constructionYear">Bygningsår</Label>
                            <Input id="edit-constructionYear" type="number" placeholder="Ukjent" value={selectedBuilding.constructionYear || ''} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, constructionYear: Number(e.target.value) || undefined })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-completionYear">Ferdigstilt</Label>
                            <Input id="edit-completionYear" type="number" placeholder="Ukjent" value={selectedBuilding.completionYear || ''} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, completionYear: Number(e.target.value) || undefined })} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-verneklasse">Verneklasse</Label>
                        <Select onValueChange={(value) => setSelectedBuilding({ ...selectedBuilding, verneklasse: value })} value={selectedBuilding.verneklasse || 'ikke_vurdert'}>
                            <SelectTrigger><SelectValue placeholder="Velg verneklasse" /></SelectTrigger>
                            <SelectContent>
                                {verneklasser.map(vk => <SelectItem key={vk.id} value={vk.id}>{vk.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-status">Status</Label>
                            <Select onValueChange={(value) => setSelectedBuilding({ ...selectedBuilding, status: value })} value={selectedBuilding.status}>
                            <SelectTrigger><SelectValue placeholder="Velg status" /></SelectTrigger>
                            <SelectContent>
                                {statuses.map(stat => <SelectItem key={stat} value={stat}>{stat}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-epoch">Epoke</Label>
                        <Select onValueChange={(value) => handleEpochChange(value, true)} value={selectedBuilding.epoch || ''}>
                            <SelectTrigger><SelectValue placeholder="Velg epoke" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE_VALUE}>Ikke spesifisert / Ukjent</SelectItem>
                                {stylesWithOptions.map(epoch => (
                                    <SelectItem key={epoch.category} value={epoch.category}>{epoch.category}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {availableStylesForEdit.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="edit-style">Stil</Label>
                            <Select onValueChange={(value) => handleStyleChange(value, true)} value={selectedBuilding.style || ''}>
                                <SelectTrigger><SelectValue placeholder="Velg stil" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE_VALUE}>Ikke spesifisert / Ukjent</SelectItem>
                                    {availableStylesForEdit.map(style => (
                                        <SelectItem key={style.name} value={style.name}>{style.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {availableSubStylesForEdit.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="edit-subStyle">Understil</Label>
                            <Select onValueChange={(value) => handleSubStyleChange(value, true)} value={selectedBuilding.subStyle || ''}>
                                <SelectTrigger><SelectValue placeholder="Velg understil" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NONE_VALUE}>Ikke spesifisert / Ukjent</SelectItem>
                                    {availableSubStylesForEdit.map(subStyle => <SelectItem key={subStyle} value={subStyle}>{subStyle}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center space-x-2">
                            <Switch id="edit-previouslyExisted-toggle" checked={selectedBuilding.previouslyExisted} onCheckedChange={(checked) => setSelectedBuilding({ ...selectedBuilding, previouslyExisted: checked })} />
                            <Label htmlFor="edit-previouslyExisted-toggle">Dokumenter tidligere bygning på tomten</Label>
                        </div>
                        {selectedBuilding.previouslyExisted && (
                            <div className="p-4 border rounded-md space-y-4 bg-muted/50">
                                <h4 className="font-medium text-center">Tidligere Bygning</h4>
                                <div className="space-y-2">
                                    <Label>Bilde av tidligere bygning</Label>
                                    {selectedBuilding.previousImageUrl && <Image src={selectedBuilding.previousImageUrl} alt="Forrige bygning" width={100} height={100} className="rounded-md border" />}
                                    <Button variant="outline" size="sm" onClick={() => { setIsFileExplorerOpen(true); setImageTarget('previous'); }}>
                                        <FolderOpen className="mr-2 h-4 w-4"/> Velg bilde
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    <Label>Bildekreditering (tidligere bygning)</Label>
                                    <Input placeholder="Ukjent" value={selectedBuilding.previousImageAttribution || ''} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, previousImageAttribution: e.target.value })} />
                                </div>
                                 <div className="space-y-2">
                                    <Label>Navn (tidligere bygning)</Label>
                                    <Input placeholder="Ukjent" value={selectedBuilding.previousName || ''} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, previousName: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Arkitekt (tidligere bygning)</Label>
                                    <Input placeholder="Ukjent" value={selectedBuilding.previousArchitect || ''} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, previousArchitect: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Eksisterte fra</Label>
                                        <Input type="number" placeholder="Årstall" value={selectedBuilding.previousConstructionYear || ''} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, previousConstructionYear: Number(e.target.value) || undefined })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Til</Label>
                                        <Input type="number" placeholder="Årstall" value={selectedBuilding.previousDemolitionYear || ''} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, previousDemolitionYear: Number(e.target.value) || undefined })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Begrunnelse for fjerning</Label>
                                    <Select onValueChange={(value) => setSelectedBuilding({ ...selectedBuilding, demolitionReason: value })} value={selectedBuilding.demolitionReason}>
                                        <SelectTrigger><SelectValue placeholder="Velg årsak" /></SelectTrigger>
                                        <SelectContent>
                                            {demolitionReasons.map(reason => <SelectItem key={reason} value={reason}>{reason}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div className="space-y-2">
                                    <Label>Lenke for "les mer"</Label>
                                    <Input placeholder="https://" value={selectedBuilding.previousInfoUrl || ''} onChange={(e) => setSelectedBuilding({ ...selectedBuilding, previousInfoUrl: e.target.value })} />
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center space-x-2">
                            <Switch id="edit-description-toggle" checked={showDescriptionEditor} onCheckedChange={setShowDescriptionEditor}/>
                            <Label htmlFor="edit-description-toggle">Rediger beskrivelse</Label>
                        </div>
                        {showDescriptionEditor && (
                            <div className="h-[400px]">
                                <MarkdownEditor 
                                    initialContent={selectedBuilding.description || ''} 
                                    onContentChange={(content) => setSelectedBuilding(prev => prev ? ({ ...prev, description: content }) : null)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>
            <DialogFooter>
                <Button type="button" onClick={handleUpdateBuilding}>Lagre endringer</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    )}
    <Dialog open={isFileExplorerOpen} onOpenChange={setIsFileExplorerOpen}>
    <DialogContent className="sm:max-w-7xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
        <DialogTitle>Velg et bilde</DialogTitle>
        </DialogHeader>
        <div className="flex-grow min-h-0">
        <FileExplorer onFileSelect={handleFileSelect} isDialog={true} />
        </div>
    </DialogContent>
    </Dialog>
    </>
  );
}
