
"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ref,
  listAll,
  getDownloadURL,
  getMetadata,
  uploadBytesResumable,
  deleteObject,
  uploadString,
  StorageReference,
} from "firebase/storage";
import { collection, onSnapshot, query } from "firebase/firestore";
import { useFirestore, useStorage } from "@/firebase/index";
import { useToast } from "@/hooks/use-toast";
import {
  File as FileIcon,
  Folder as FolderIcon,
  Upload,
  MoreVertical,
  Trash2,
  Download,
  Loader2,
  Home,
  ChevronRight,
  Copy,
  FolderPlus,
  Search,
  X,
  Check,
  ChevronsUpDown,
  ImageIcon,
  Wifi,
  FileAudio,
  Link as LinkIcon,
} from "lucide-react";
import Image from "next/image";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";


interface FileItem {
  name: string;
  type: "file";
  url: string;
  size: number;
  fullPath: string;
}

interface FolderItem {
  name: string;
  type: "folder";
  fullPath: string;
}

type StorageItem = FileItem | FolderItem;

type WikimediaImage = {
    title: string;
    preferred: {
        url: string;
    };
    attribution: string;
}

type UploadableFile = {
    id: string;
    file: File;
    fileName: string;
    destinationPath: string;
};

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

const FileTypeIcon = ({ item, isSelected }: { item: StorageItem, isSelected: boolean }) => {
  if (item.type === "folder") {
    return <FolderIcon className="w-full h-full text-primary" />;
  }

  if (item.name === '.placeholder') return null;

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(item.name);
  if (isImage) {
    return (
      <div className="relative w-full h-full">
        <Image
          src={item.url}
          alt={item.name}
          width={64}
          height={64}
          className="w-full h-full object-cover rounded-md"
          unoptimized
        />
        {isSelected && (
          <div className="absolute inset-0 bg-primary/50 flex items-center justify-center">
            <Check className="h-8 w-8 text-primary-foreground" />
          </div>
        )}
      </div>
    );
  }

  const isAudio = /\.(mp3|wav|ogg|m4a)$/i.test(item.name);
  if (isAudio) {
    return <FileAudio className="w-full h-full text-muted-foreground" />;
  }

  return <FileIcon className="w-full h-full text-muted-foreground" />;
};

export type SelectedFile = {
    url: string;
    name: string;
    attribution?: string;
};
interface FileExplorerProps {
    onFileSelect: (files: SelectedFile[]) => void;
    isDialog?: boolean;
}


// Internal component to manage its own state
const UploadQueueItem = ({
    item,
    index,
    onUpdate,
    onRemove,
    allFolders,
}: {
    item: UploadableFile;
    index: number;
    onUpdate: (id: string, field: 'fileName' | 'destinationPath', value: string) => void;
    onRemove: (id: string) => void;
    allFolders: string[];
}) => {
    const [comboboxOpen, setComboboxOpen] = useState(false);

    const fileParts = item.file.name.split('.');
    const extension = fileParts.length > 1 ? `.${fileParts.pop()}` : '';
    const baseName = item.fileName.substring(0, item.fileName.length - extension.length);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(item.id, 'fileName', e.target.value + extension);
    }

    return (
        <Card key={item.id} className="relative p-4">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => onRemove(item.id)}>
                <X className="h-4 w-4" />
            </Button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor={`fileName-${index}`}>Filnavn</Label>
                    <div className="flex">
                        <Input
                            id={`fileName-${index}`}
                            value={baseName}
                            onChange={handleNameChange}
                            className="rounded-r-none"
                        />
                        <span className="flex items-center justify-center rounded-r-md border border-l-0 bg-muted px-3 text-sm text-muted-foreground">
                            {extension}
                        </span>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`folder-${index}`}>Målmappe</Label>
                    <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={comboboxOpen}
                                className="w-full justify-between"
                            >
                                {item.destinationPath || "Hovedmappe"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput
                                    placeholder="Søk eller skriv ny mappe..."
                                    onValueChange={(search) => onUpdate(item.id, 'destinationPath', search)}
                                />
                                <CommandEmpty>Ingen mappe funnet.</CommandEmpty>
                                <CommandGroup>
                                    <CommandList>
                                        {allFolders.map((folder) => (
                                            <CommandItem
                                                key={folder}
                                                value={folder}
                                                onSelect={(currentValue) => {
                                                    onUpdate(item.id, 'destinationPath', currentValue === item.destinationPath ? "" : currentValue);
                                                    setComboboxOpen(false);
                                                }}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", item.destinationPath === folder ? "opacity-100" : "opacity-0")} />
                                                {folder || "Hovedmappe"}
                                            </CommandItem>
                                        ))}
                                    </CommandList>
                                </CommandGroup>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Original: {item.file.name} ({formatBytes(item.file.size)})</p>
        </Card>
    );
};


export function FileExplorer({ onFileSelect, isDialog = false }: FileExplorerProps) {
  const storage = useStorage();
  const firestore = useFirestore();
  const [items, setItems] = useState<StorageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [path, setPath] = useState("");
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [allFolders, setAllFolders] = useState<string[]>([]);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  
  const [dialogState, setDialogState] = useState<{
    type: 'delete' | 'new-folder' | 'upload' | null;
    item: StorageItem | null;
  }>({ type: null, item: null });
  const [newName, setNewName] = useState("");
  const [uploadQueue, setUploadQueue] = useState<UploadableFile[]>([]);
  
  const [wikimediaSearchTerm, setWikimediaSearchTerm] = useState("");
  const [wikimediaResults, setWikimediaResults] = useState<WikimediaImage[]>([]);
  const [isWikimediaLoading, setIsWikimediaLoading] = useState(false);

  const [imageUrl, setImageUrl] = useState("");
  const [imageAttribution, setImageAttribution] = useState("");
  const [base64Input, setBase64Input] = useState("");
  
  const [instagramImages, setInstagramImages] = useState<SelectedFile[]>([]);
  const [isInstagramLoading, setIsInstagramLoading] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    if (!firestore) return;
    setIsInstagramLoading(true);
    const q = query(collection(firestore, "instagramLinks"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const base64Images: SelectedFile[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.imageUrl && data.imageUrl.startsWith('data:image/')) {
                base64Images.push({
                    url: data.imageUrl,
                    name: `Instagram: ${doc.id.substring(0, 5)}`,
                    attribution: 'Instagram Bio'
                });
            }
        });
        setInstagramImages(base64Images);
        setIsInstagramLoading(false);
    }, (error) => {
        console.error("Error fetching instagram links:", error);
        toast({ title: "Kunne ikke hente bilder", description: "Feil ved henting av bilder fra Instagram-siden.", variant: "destructive" });
        setIsInstagramLoading(false);
    });
    return () => unsubscribe();
  }, [firestore, toast]);


  const fetchItems = useCallback(async (currentPath: string) => {
    setIsLoading(true);
    try {
      const folderRef = ref(storage, currentPath);
      const res = await listAll(folderRef);

      const folders: FolderItem[] = res.prefixes.map((folderRef) => ({
        name: folderRef.name,
        type: "folder",
        fullPath: folderRef.fullPath,
      }));

      const files: FileItem[] = (await Promise.all(
        res.items.map(async (itemRef) => {
          if (itemRef.name === '.placeholder') return null;
          const [url, metadata] = await Promise.all([
            getDownloadURL(itemRef),
            getMetadata(itemRef),
          ]);
          return {
            name: itemRef.name,
            type: "file",
            url,
            size: metadata.size,
            fullPath: itemRef.fullPath,
          };
        })
      )).filter((item): item is FileItem => item !== null);

      setItems([...folders, ...files]);
    } catch (error: any) {
      console.error("Error fetching files:", error);
      toast({
        title: "Error fetching files",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, storage]);
  
  const fetchAllRecursive = useCallback(async (folderRef: StorageReference): Promise<{ files: FileItem[], folders: string[] }> => {
    let fileItems: FileItem[] = [];
    let folderPaths: string[] = [];
    const res = await listAll(folderRef);

    const filePromises = res.items
      .filter(itemRef => itemRef.name !== '.placeholder')
      .map(async (itemRef) => {
        const [url, metadata] = await Promise.all([
          getDownloadURL(itemRef),
          getMetadata(itemRef),
        ]);
        return {
          name: itemRef.name,
          type: "file" as "file",
          url,
          size: metadata.size,
          fullPath: itemRef.fullPath,
        };
      });
      
    const files = await Promise.all(filePromises);
    fileItems = fileItems.concat(files);

    for (const prefix of res.prefixes) {
      folderPaths.push(prefix.fullPath);
      const nested = await fetchAllRecursive(prefix);
      fileItems = fileItems.concat(nested.files);
      folderPaths = folderPaths.concat(nested.folders);
    }

    return { files: fileItems, folders: folderPaths };
  }, [storage]);


  useEffect(() => {
    if (isGlobalSearch && allFiles.length === 0) {
      setIsFetchingAll(true);
      const rootRef = ref(storage, '');
      fetchAllRecursive(rootRef)
        .then(results => {
          setAllFiles(results.files);
          setAllFolders(['', ...results.folders.sort()]);
          setIsFetchingAll(false);
        })
        .catch(error => {
          console.error("Error fetching all files/folders:", error);
          toast({ title: "Failed to fetch all files/folders", variant: "destructive" });
          setIsFetchingAll(false);
        });
    }
  }, [isGlobalSearch, allFiles.length, fetchAllRecursive, toast, storage]);
  
  useEffect(() => {
    if (dialogState.type === 'upload' && allFolders.length === 0) {
      setIsFetchingAll(true);
      const rootRef = ref(storage, '');
      fetchAllRecursive(rootRef)
        .then(results => {
          setAllFolders(['', ...results.folders.sort()]);
          setIsFetchingAll(false);
        })
        .catch(error => {
          console.error("Error fetching all folders for upload:", error);
          toast({ title: "Failed to fetch folder list", variant: "destructive" });
          setIsFetchingAll(false);
        });
    }
  }, [dialogState.type, allFolders.length, fetchAllRecursive, toast, storage]);

  useEffect(() => {
    if (!isGlobalSearch) {
        fetchItems(path);
    }
  }, [path, fetchItems, isGlobalSearch]);

  const handleNavigate = (newPath: string) => {
    setPath(newPath);
    setIsGlobalSearch(false);
    setSelectedFiles([]);
  };
  
  const handleItemClick = (item: StorageItem) => {
    if (item.type === 'folder') {
        handleNavigate(item.fullPath);
    } else if (isDialog) {
        if (multiSelectMode) {
            setSelectedFiles(prev => {
                const isSelected = prev.some(f => f.url === (item as FileItem).url);
                if (isSelected) {
                    return prev.filter(f => f.url !== (item as FileItem).url);
                } else {
                    return [...prev, { url: (item as FileItem).url, name: item.name }];
                }
            });
        } else {
            onFileSelect([{ url: (item as FileItem).url, name: item.name }]);
        }
    }
  }

  const handleFileSelection = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newUploads = Array.from(files).map(file => ({
        id: `${file.name}-${file.lastModified}`,
        file,
        fileName: file.name,
        destinationPath: path,
    }));
    setUploadQueue(prev => [...prev, ...newUploads]);
    setDialogState({ type: 'upload', item: null });
  };
  
  const handleUpdateUploadQueue = (id: string, field: 'fileName' | 'destinationPath', value: string) => {
    setUploadQueue(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const handleRemoveFromUploadQueue = (id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  const handleStartUpload = () => {
    const filesToUpload = [...uploadQueue];
    closeDialog();

    filesToUpload.forEach((uploadable) => {
      const destination = uploadable.destinationPath ? `${uploadable.destinationPath}/${uploadable.fileName}` : uploadable.fileName;
      const storageRef = ref(storage, destination);
      const uploadTask = uploadBytesResumable(storageRef, uploadable.file);
  
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress((prev) => ({ ...prev, [uploadable.fileName]: progress }));
        },
        (error) => {
          console.error("Upload error:", error);
          toast({
            title: `Upload failed for ${uploadable.fileName}`,
            description: error.message,
            variant: "destructive",
          });
          setUploadProgress((prev) => {
            const newState = { ...prev };
            delete newState[uploadable.fileName];
            return newState;
          });
        },
        () => {
          toast({ title: "Upload complete", description: `${uploadable.fileName} has been uploaded.` });
          setUploadProgress((prev) => {
            const newState = { ...prev };
            delete newState[uploadable.fileName];
            return newState;
          });
          fetchItems(path); 
        }
      );
    });
  };

  const closeDialog = () => {
    setDialogState({ type: null, item: null });
    setNewName("");
    setUploadQueue([]);
  }
  
  const handleDelete = async () => {
    if (!dialogState.item) return;
    try {
        const itemRef = ref(storage, dialogState.item.fullPath);
        if (dialogState.item.type === 'file') {
            await deleteObject(itemRef);
            toast({ title: "File deleted", description: `${dialogState.item.name} has been deleted.` });
        } else { 
            const placeholderRef = ref(storage, `${dialogState.item.fullPath}/.placeholder`);
            try {
                await deleteObject(placeholderRef);
            } catch (e) {
                // Ignore if placeholder not found, might be a non-empty folder
            }
            toast({ title: "Folder deleted", description: `${dialogState.item.name} has been deleted.` });
        }
        fetchItems(path);
    } catch (error: any) {
        console.error("Error deleting item:", error);
        toast({ title: "Deletion failed", description: `Could not delete. The folder might not be empty. Error: ${error.message}`, variant: "destructive" });
    } finally {
        closeDialog();
    }
  };
  
  const handleNewFolder = async () => {
    if (!newName) return;
    const folderPath = `${path ? path + "/" : ""}${newName}/.placeholder`;
    const folderRef = ref(storage, folderPath);
    
    try {
        await uploadString(folderRef, "");
        toast({ title: "Folder created", description: `Folder "${newName}" was created.` });
        fetchItems(path);
    } catch (error: any) {
        console.error("Error creating folder:", error);
        toast({ title: "Folder creation failed", description: error.message, variant: "destructive" });
    }
    closeDialog();
  }


  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "URL copied to clipboard!" });
  }

  const handleDownload = (item: FileItem) => {
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleWikimediaSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wikimediaSearchTerm) return;
    setIsWikimediaLoading(true);
    setWikimediaResults([]);

    const searchUrl = new URL('https://commons.wikimedia.org/w/api.php');
    searchUrl.searchParams.append('action', 'query');
    searchUrl.searchParams.append('generator', 'search');
    searchUrl.searchParams.append('gsrsearch', wikimediaSearchTerm);
    searchUrl.searchParams.append('gsrnamespace', '6');
    searchUrl.searchParams.append('gsrlimit', '50');
    searchUrl.searchParams.append('prop', 'imageinfo');
    searchUrl.searchParams.append('iiprop', 'url|user|extmetadata'); 
    searchUrl.searchParams.append('format', 'json');
    searchUrl.searchParams.append('origin', '*');

    try {
      const response = await fetch(searchUrl.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch from Wikimedia: ${response.statusText}`);
      }
      const data = await response.json();
      
      if (!data.query || !data.query.pages) {
        setWikimediaResults([]);
        return;
      }

      const pages = Object.values(data.query.pages) as any[];
      const imageList = pages
        .filter(page => page.imageinfo && page.imageinfo.length > 0)
        .map(page => {
          const imageInfo = page.imageinfo[0];
          const metadata = imageInfo.extmetadata;
          
          let attributionParts: string[] = [];
          if (metadata?.Artist?.value) {
            const artistText = metadata.Artist.value.replace(/<[^>]*>?/gm, '');
            attributionParts.push(artistText);
          } else if (imageInfo.user) {
            attributionParts.push(imageInfo.user);
          }
          
          if (metadata?.LicenseShortName?.value) {
            attributionParts.push(metadata.LicenseShortName.value);
          }

          return {
            title: page.title,
            preferred: {
              url: imageInfo.url,
            },
            attribution: attributionParts.join(' / '),
          };
        });

      setWikimediaResults(imageList);

    } catch(error: any) {
       console.error("Wikimedia search failed:", error);
       toast({ title: "Wikimedia search failed", description: error.message, variant: "destructive" });
    } finally {
        setIsWikimediaLoading(false);
    }
  };
  
  const handleWikimediaSelect = (image: WikimediaImage) => {
     if (isDialog) {
        const file = { url: image.preferred.url, name: image.title, attribution: image.attribution };
        if (multiSelectMode) {
             const isSelected = selectedFiles.some(f => f.url === file.url);
             if (isSelected) {
                 setSelectedFiles(prev => prev.filter(f => f.url !== file.url));
             } else {
                 setSelectedFiles(prev => [...prev, file]);
             }
        } else {
            onFileSelect([file]);
        }
    } else {
        handleCopyUrl(image.preferred.url);
    }
  }

  const handleInstagramImageSelect = (image: SelectedFile) => {
    if (isDialog) {
        if (multiSelectMode) {
            const isSelected = selectedFiles.some(f => f.url === image.url);
            if (isSelected) {
                setSelectedFiles(prev => prev.filter(f => f.url !== image.url));
            } else {
                setSelectedFiles(prev => [...prev, image]);
            }
        } else {
            onFileSelect([image]);
        }
    } else {
        handleCopyUrl(image.url);
    }
  };

  const handleAddFromUrl = () => {
    if (!imageUrl) {
        toast({ title: "URL mangler", description: "Vennligst skriv inn en bilde-URL.", variant: "destructive" });
        return;
    }
    let name = "bilde";
    try {
        const url = new URL(imageUrl);
        const pathParts = url.pathname.split('/');
        name = pathParts.pop() || "bilde";
    } catch (e) {
      // ignore
    }

    const file = { url: imageUrl, name, attribution: imageAttribution || undefined };

    if (multiSelectMode && isDialog) {
        setSelectedFiles(prev => [...prev, file]);
        toast({ title: "Bilde lagt til i utvalg" });
    } else {
        onFileSelect([file]);
    }
    setImageUrl("");
    setImageAttribution("");
  }

  const base64Preview = React.useMemo(() => {
    if (base64Input.startsWith('data:image/') && base64Input.includes(';base64,')) {
        return base64Input;
    }
    return null;
  }, [base64Input]);


  const pathSegments = path.split('/').filter(Boolean);
  
  const filteredItems = isGlobalSearch 
    ? allFiles.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const displayItems = searchTerm ? filteredItems : items;

  return (
    <>
      <Card className={cn("flex flex-col h-full", isDialog ? "shadow-none border-0" : "")}>
        <Tabs defaultValue="firebase" className="flex flex-col h-full">
            <CardHeader className="p-4 md:p-6 flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <TabsList className="grid grid-cols-4 w-full md:w-auto">
                    <TabsTrigger value="firebase"><FolderIcon className="mr-2 h-4 w-4" />Dine Filer</TabsTrigger>
                    <TabsTrigger value="wikimedia"><Wifi className="mr-2 h-4 w-4" />Søk Wikimedia</TabsTrigger>
                    <TabsTrigger value="url"><LinkIcon className="mr-2 h-4 w-4" />Legg til fra URL</TabsTrigger>
                    <TabsTrigger value="base64"><ImageIcon className="mr-2 h-4 w-4"/>Base64</TabsTrigger>
                </TabsList>
                 <div className="flex w-full md:w-auto gap-2">
                    <Button variant="outline" onClick={() => setDialogState({ type: 'new-folder', item: null })}>
                        <FolderPlus className="mr-2 h-4 w-4" />
                        Ny mappe
                    </Button>
                    <Button asChild>
                        <Label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="mr-2 h-4 w-4" />
                        Last opp fil
                        </Label>
                    </Button>
                    <Input id="file-upload" type="file" multiple className="hidden" onChange={(e) => handleFileSelection(e.target.files)} />
                </div>
            </CardHeader>
            <TabsContent value="firebase" className="p-4 md:p-6 pt-0 flex-grow min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                <div className="flex flex-wrap items-center gap-4 mb-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Søk i nåværende mappe..." className="pl-9 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="global-search-switch" checked={isGlobalSearch} onCheckedChange={setIsGlobalSearch} />
                        <Label htmlFor="global-search-switch">Søk i alle mapper</Label>
                        {isFetchingAll && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                     {isDialog && (
                         <div className="flex items-center space-x-2">
                            <Switch id="multi-select-switch" checked={multiSelectMode} onCheckedChange={(checked) => { setMultiSelectMode(checked); if (!checked) setSelectedFiles([]); }} />
                            <Label htmlFor="multi-select-switch">Velg flere</Label>
                        </div>
                     )}
                </div>

                {!isGlobalSearch && (
                    <Breadcrumb className="mb-4">
                        <BreadcrumbList>
                        <BreadcrumbItem><BreadcrumbLink onClick={() => handleNavigate("")} className="cursor-pointer flex items-center gap-2"><Home className="h-4 w-4" /> Hjem</BreadcrumbLink></BreadcrumbItem>
                        {pathSegments.map((segment, index) => {
                            const segmentPath = pathSegments.slice(0, index + 1).join("/");
                            const isLast = index === pathSegments.length - 1;
                            return (
                            <React.Fragment key={segment}>
                                <BreadcrumbSeparator><ChevronRight /></BreadcrumbSeparator>
                                <BreadcrumbItem>{isLast ? <BreadcrumbPage>{segment}</BreadcrumbPage> : <BreadcrumbLink onClick={() => handleNavigate(segmentPath)} className="cursor-pointer">{segment}</BreadcrumbLink>}</BreadcrumbItem>
                            </React.Fragment>
                            );
                        })}
                        </BreadcrumbList>
                    </Breadcrumb>
                )}

                {Object.keys(uploadProgress).length > 0 && (
                    <div className="space-y-2 rounded-lg border p-4 mb-4"><h3 className="font-medium">Opplastinger</h3>{Object.entries(uploadProgress).map(([name, progress]) => (<div key={name}><p className="text-sm text-muted-foreground">{name}</p><Progress value={progress} className="h-2" /></div>))}</div>
                )}
                
                <div className="flex-grow overflow-auto relative">
                    {isLoading ? <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    : filteredItems.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 pr-2">
                        {filteredItems.map((item) => {
                            const isSelected = multiSelectMode && item.type === 'file' && selectedFiles.some(f => f.url === item.url);
                            return (
                                <div key={item.fullPath} className="group relative">
                                    <button className={cn("w-full text-center items-center justify-center space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg", isSelected && "ring-2 ring-primary ring-offset-2")} onClick={() => handleItemClick(item)}>
                                        <div className="aspect-square w-full rounded-t-lg border p-2 flex items-center justify-center transition-colors hover:bg-muted/50"><FileTypeIcon item={item} isSelected={isSelected} /></div>
                                        <div className="p-2 border border-t-0 rounded-b-lg"><p className="text-sm font-medium truncate">{item.name}</p>{item.type === "file" && <p className="text-xs text-muted-foreground">{formatBytes(item.size)}</p>}</div>
                                    </button>
                                    <div className="absolute top-1 right-1">
                                        <DropdownMenu modal={false}>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" type="button" onClick={(e) => e.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {item.type === 'file' && (
                                                <>
                                                    <DropdownMenuItem onSelect={() => handleDownload(item as FileItem)}><Download className="mr-2 h-4 w-4" /> Last ned</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleCopyUrl(item.url)}><Copy className="mr-2 h-4 w-4" /> Kopier URL</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                </>
                                                )}
                                                <DropdownMenuItem onClick={() => setDialogState({ type: 'delete', item })} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Slett</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            )
                        })}
                        </div>
                    ) : <div className="text-center text-muted-foreground py-16"><p>{searchTerm ? 'Ingen elementer passer søket ditt.' : 'Denne mappen er tom.'}</p></div>
                    }
                </div>
                 {multiSelectMode && selectedFiles.length > 0 && (
                    <div className="p-4 mt-4 border-t bg-background/95 flex items-center justify-between gap-4">
                        <p className="text-sm font-medium">{selectedFiles.length} bilde{selectedFiles.length > 1 ? 'r' : ''} valgt</p>
                        <div className="flex gap-2">
                             <Button variant="outline" onClick={() => setSelectedFiles([])}>Avbryt</Button>
                             <Button onClick={() => onFileSelect(selectedFiles)}>Legg til valgte</Button>
                        </div>
                    </div>
                 )}
            </TabsContent>
            <TabsContent value="wikimedia" className="p-4 md:p-6 pt-0 flex-grow min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                <form onSubmit={handleWikimediaSearch} className="flex gap-2 mb-4">
                    <Input placeholder="Søk på Wikimedia Commons..." value={wikimediaSearchTerm} onChange={(e) => setWikimediaSearchTerm(e.target.value)} />
                    <Button type="submit" disabled={isWikimediaLoading}>{isWikimediaLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}</Button>
                </form>
                 {isDialog && (
                    <div className="flex items-center space-x-2 mb-4">
                        <Switch id="wikimedia-multi-select-switch" checked={multiSelectMode} onCheckedChange={(checked) => { setMultiSelectMode(checked); if (!checked) setSelectedFiles([]); }} />
                        <Label htmlFor="wikimedia-multi-select-switch">Velg flere</Label>
                    </div>
                 )}
                <div className="flex-grow overflow-auto relative">
                    {isWikimediaLoading ? <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    : wikimediaResults.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 pr-2">
                        {wikimediaResults.map((image) => {
                             const isSelected = multiSelectMode && selectedFiles.some(f => f.url === image.preferred.url);
                             return (
                               <div key={image.title} className="group relative">
                                    <div className={cn("aspect-square w-full rounded-lg border p-2 flex items-center justify-center transition-colors hover:bg-muted/50 cursor-pointer", isSelected && "ring-2 ring-primary ring-offset-2")} onClick={() => handleWikimediaSelect(image)}>
                                        <Image src={image.preferred.url} alt={image.title} width={150} height={150} className="w-full h-full object-cover rounded-md" unoptimized />
                                         {isSelected && (
                                            <div className="absolute inset-0 bg-primary/50 flex items-center justify-center">
                                                <Check className="h-8 w-8 text-primary-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs font-medium truncate mt-1 text-center" title={image.title.replace('File:', '').replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')}>{image.title.replace('File:', '').replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')}</p>
                                    <p className="text-xs text-muted-foreground truncate text-center" title={image.attribution}>{image.attribution || 'Ukjent kreditering'}</p>
                                </div>
                             )
                        })}
                        </div>
                    ) : <div className="text-center text-muted-foreground py-16"><p>Søk etter bilder på Wikimedia Commons for å se resultater her.</p></div>
                    }
                    {multiSelectMode && selectedFiles.length > 0 && (
                        <div className="sticky bottom-0 p-4 mt-4 border-t bg-background/95 flex items-center justify-between gap-4">
                            <p className="text-sm font-medium">{selectedFiles.length} bilde{selectedFiles.length > 1 ? 'r' : ''} valgt</p>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setSelectedFiles([])}>Fjern alle</Button>
                                <Button onClick={() => { onFileSelect(selectedFiles); setSelectedFiles([]); }}>Legg til valgte</Button>
                            </div>
                        </div>
                    )}
                </div>
            </TabsContent>
             <TabsContent value="url" className="p-4 md:p-6 pt-0 flex-grow min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                <div className="space-y-4 max-w-lg mx-auto">
                    <div className="space-y-2">
                        <Label htmlFor="image-url">Bilde-URL</Label>
                        <Input id="image-url" placeholder="https://..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="image-attribution">Kreditering (valgfritt)</Label>
                        <Input id="image-attribution" placeholder="Navn på fotograf / Kilde" value={imageAttribution} onChange={(e) => setImageAttribution(e.target.value)} />
                    </div>
                    <Button onClick={handleAddFromUrl}>{multiSelectMode ? 'Legg til i utvalg' : 'Legg til bilde'}</Button>
                </div>
            </TabsContent>
            <TabsContent value="base64" className="p-4 md:p-6 pt-0 flex-grow min-h-0 flex flex-col mt-0 data-[state=inactive]:hidden">
                <ScrollArea className="h-full -mx-6 px-6">
                  <div className="space-y-6 pr-2">
                      <div>
                          <h3 className="font-semibold mb-4">Bilder fra Instagram Bio</h3>
                           {isDialog && (
                                <div className="flex items-center space-x-2 mb-4">
                                    <Switch id="base64-multi-select-switch" checked={multiSelectMode} onCheckedChange={(checked) => { setMultiSelectMode(checked); if (!checked) setSelectedFiles([]); }} />
                                    <Label htmlFor="base64-multi-select-switch">Velg flere</Label>
                                </div>
                            )}
                          {isInstagramLoading ? (
                              <div className="flex items-center justify-center h-24">
                                  <Loader2 className="h-6 w-6 animate-spin"/>
                              </div>
                          ) : instagramImages.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                  {instagramImages.map((image, index) => {
                                      const isSelected = multiSelectMode && selectedFiles.some(f => f.url === image.url);
                                      return (
                                          <div key={`${image.name}-${index}`} className="group relative">
                                              <div
                                                  className={cn("aspect-square w-full rounded-lg border p-2 flex items-center justify-center transition-colors hover:bg-muted/50 cursor-pointer", isSelected && "ring-2 ring-primary ring-offset-2")}
                                                  onClick={() => handleInstagramImageSelect(image)}
                                              >
                                                  <Image src={image.url} alt={image.name} width={150} height={150} className="w-full h-full object-cover rounded-md" unoptimized />
                                                  {isSelected && (
                                                      <div className="absolute inset-0 bg-primary/50 flex items-center justify-center">
                                                          <Check className="h-8 w-8 text-primary-foreground" />
                                                      </div>
                                                  )}
                                              </div>
                                              <p className="text-xs font-medium truncate mt-1 text-center" title={image.name}>{image.name}</p>
                                          </div>
                                      )
                                  })}
                              </div>
                          ) : (
                              <p className="text-sm text-muted-foreground text-center py-4">Fant ingen base64-bilder på Instagram Bio-siden.</p>
                          )}
                      </div>

                      <div className="space-y-4 pt-6 border-t">
                          <h3 className="font-semibold">Lim inn egen Base64</h3>
                          <div className="space-y-2">
                              <Label htmlFor="base64-input">Base64 Data URI</Label>
                              <Textarea 
                                  id="base64-input" 
                                  placeholder="Lim inn base64 data URI her... f.eks. data:image/png;base64,iVBORw0KGgo..." 
                                  rows={4}
                                  value={base64Input} 
                                  onChange={(e) => setBase64Input(e.target.value)}
                              />
                          </div>
                          {base64Preview && (
                              <div className="space-y-4">
                                  <Label>Forhåndsvisning</Label>
                                  <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/50 h-48">
                                      <Image src={base64Preview} alt="Base64 Preview" width={150} height={150} className="object-contain max-h-full max-w-full" />
                                  </div>
                                  <Button onClick={() => onFileSelect([{ url: base64Preview, name: 'base64-image.png' }])} className="w-full">
                                      Bruk dette bildet
                                  </Button>
                              </div>
                          )}
                      </div>
                  </div>
                   {multiSelectMode && selectedFiles.length > 0 && (
                        <div className="sticky bottom-0 p-4 mt-4 border-t bg-background/95 flex items-center justify-between gap-4">
                            <p className="text-sm font-medium">{selectedFiles.length} bilde{selectedFiles.length > 1 ? 'r' : ''} valgt</p>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setSelectedFiles([])}>Fjern alle</Button>
                                <Button onClick={() => { onFileSelect(selectedFiles); setSelectedFiles([]); }}>Legg til valgte</Button>
                            </div>
                        </div>
                    )}
                </ScrollArea>
            </TabsContent>
        </Tabs>
    </Card>
    
    <AlertDialog open={dialogState.type === 'delete'} onOpenChange={(open) => !open && closeDialog()}>
    <AlertDialogContent>
        <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
                Du er i ferd med å slette <strong>{dialogState.item?.name}</strong>. Denne handlingen kan ikke angres.
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDialog}>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Ja, slett</AlertDialogAction>
        </AlertDialogFooter>
    </AlertDialogContent>
    </AlertDialog>

    <Dialog open={dialogState.type === 'new-folder'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Ny mappe</DialogTitle>
                <DialogDescription>Skriv inn navnet på den nye mappen.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <Label htmlFor="new-name" className="sr-only">New Name</Label>
                <Input
                    id="new-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Mappenavn"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleNewFolder();
                        }
                    }}
                />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Avbryt</Button>
                <Button onClick={handleNewFolder}>Lagre</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog open={dialogState.type === 'upload'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>Filopplasting</DialogTitle>
                <DialogDescription>
                    Gi filene nytt navn og velg målmappe før du laster opp.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] -mx-6 px-6">
                <div className="space-y-4 pr-2">
                    {uploadQueue.map((item, index) => (
                        <UploadQueueItem
                            key={item.id}
                            item={item}
                            index={index}
                            onUpdate={handleUpdateUploadQueue}
                            onRemove={handleRemoveFromUploadQueue}
                            allFolders={allFolders}
                        />
                    ))}
                </div>
            </ScrollArea>
            <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Avbryt</Button>
                <Button onClick={handleStartUpload} disabled={uploadQueue.length === 0 || isFetchingAll}>
                    {isFetchingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Start Opplasting ({uploadQueue.length})
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
