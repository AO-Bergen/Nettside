'use client';

import { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { type EventFromFirestore } from '@/app/dashboard/events/page';
import { cn } from '@/lib/utils';
import { Upload, Download, FolderOpen, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileExplorer, type SelectedFile } from "@/components/site/file-explorer";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_LOGO } from '@/lib/constants';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';


const COLORS = [
  { label: "Lysegul", value: "#fffdf7", border: "#e8e0c0" },
  { label: "Lysegrønn", value: "#f7fff7", border: "#b8deb8" },
  { label: "Lyselilla", value: "#f7f9ff", border: "#c8c8e8" },
];

const FORMATS = [
  { id: "instagram", label: "Instagram", sub: "1080 × 1350 px (4:5)", w: 1080, h: 1350, aspect: 4/5 },
  { id: "a4", label: "A4-plakat", sub: "595 × 842 px", w: 595, h: 842, aspect: 595/842 },
  { id: "wide", label: "Bredformat", sub: "16:9", w: 1920, h: 1080, aspect: 16/9 },
];

function formatDate(dateObj: Date) {
  return dateObj.toLocaleDateString("nb-NO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function PosterCanvas({ event, color, format, showQR, uploadedImage, imageHeight, canvasRef, logoUrl, qrCodeDataUrl }: any) {
    const fmt = FORMATS.find(f => f.id === format);
    if (!fmt) return null;
    const bg = COLORS.find(c => c.value === color);
    if (!bg) return null;

    const PREVIEW_W = 340;
    const PREVIEW_H = Math.round(PREVIEW_W / fmt.aspect);
    const W = fmt.w, H = fmt.h;
  
    const qrSize = Math.round(W * 0.12);
    
    const isWide = format === "wide";
    const titleSize = isWide ? Math.round(W * 0.055) : Math.round(W * 0.072);
    const metaSize = isWide ? Math.round(W * 0.025) : Math.round(W * 0.032);
    const orgSize = isWide ? Math.round(W * 0.022) : Math.round(W * 0.028);
    const logoSz = isWide ? Math.round(W * 0.05) : Math.round(W * 0.1);
    const pad = Math.round(W * 0.08);
    const topH = isWide ? Math.round(H * 0.22) : Math.round(H * 0.18);
    const qrX = W - pad - qrSize;
    const qrY = H - pad - qrSize;
  
    const imgY = topH + Math.round(H * 0.04);
    const imgH = uploadedImage ? Math.round(H * (imageHeight / 100)) : 0;
    const imgW = W - pad * 2;
  
    const metaY = imgY + imgH + Math.round(H * 0.04);
  
    const titleY = uploadedImage
      ? topH + Math.round(H * (isWide ? 0.09 : 0.07))
      : (isWide ? topH + H * 0.18 : topH + H * 0.13);
  
    return (
      <div style={{ width: PREVIEW_W, height: PREVIEW_H, overflow: "hidden", borderRadius: 8, boxShadow: "0 2px 16px rgba(0,0,0,0.13)", border: `1.5px solid ${bg.border}` }}>
        <svg
          ref={canvasRef}
          width={W} height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: PREVIEW_W, height: PREVIEW_H, display: "block" }}
        >
          <rect width={W} height={H} fill={color}/>
          <rect width={W} height={6} fill="#1a1a1a"/>
  
          {logoUrl && (
              <image href={logoUrl} x={pad} y={pad + 10} width={logoSz} height={logoSz} />
          )}
          <text x={pad + logoSz + 14} y={pad + 10 + logoSz * 0.5 + orgSize * 0.38}
            fontSize={orgSize} fontWeight="700" fill="#1a1a1a" letterSpacing="1">
            ARKITEKTUROPPRØRET BERGEN
          </text>
  
          <line x1={pad} y1={topH} x2={W - pad} y2={topH} stroke="#1a1a1a" strokeWidth="1.5"/>
  
          {uploadedImage && (
            <image href={uploadedImage} x={pad} y={imgY} width={imgW} height={imgH}
              preserveAspectRatio="xMidYMid slice"/>
          )}
  
          {event ? (() => {
            const words = event.title.split(" ");
            const lines: string[] = [];
            let line = "";
            const maxW = W - pad * 2;
            const approxCharW = titleSize * 0.58;
            const maxChars = Math.floor(maxW / approxCharW);
            words.forEach((w: string) => {
              if ((line + " " + w).trim().length > maxChars) { lines.push(line.trim()); line = w; }
              else line = (line + " " + w).trim();
            });
            if (line) lines.push(line.trim());
            const ty = uploadedImage ? imgY + imgH + Math.round(H * 0.04) : titleY;
            const ms = uploadedImage ? Math.round(titleSize * 0.85) : titleSize;
            return lines.map((l, i) => (
              <text key={i} x={pad} y={ty + i * (ms * 1.15)}
                fontSize={ms} fontWeight="800" fill="#1a1a1a" letterSpacing="-0.5">{l}</text>
            ));
          })() : (
            <text x={pad} y={titleY} fontSize={titleSize} fontWeight="800" fill="#ccc">Velg eit arrangement</text>
          )}
  
          {event && (() => {
            const baseY = uploadedImage
              ? imgY + imgH + Math.round(H * 0.04) + titleSize * 1.3 * Math.ceil(event.title.split(" ").length / 3) + Math.round(H * 0.04)
              : H * 0.72;
            return (
              <g>
                <text x={pad} y={baseY} fontSize={metaSize} fill="#444" fontWeight="600">{event.eventDate ? formatDate(event.eventDate.toDate()).toUpperCase() : ""}</text>
                <text x={pad} y={baseY + metaSize * 1.6} fontSize={metaSize} fill="#444">kl. {event.eventTime}</text>
                <text x={pad} y={baseY + metaSize * 3.2} fontSize={metaSize} fill="#444">{event.location}</text>
              </g>
            );
          })()}
  
          {showQR && qrCodeDataUrl && (
            <g transform={`translate(${qrX}, ${qrY})`}>
                <rect width={qrSize} height={qrSize} rx="3" fill="white" opacity="0.95"/>
                <image href={qrCodeDataUrl} x={pad * 0.05} y={pad * 0.05} width={qrSize - (pad * 0.1)} height={qrSize - (pad * 0.1)} />
                <text x={qrSize / 2} y={qrSize + metaSize * 1.1} fontSize={metaSize * 0.7} fill="#888" textAnchor="middle">Skann for info</text>
            </g>
          )}
  
          <rect y={H - 5} width={W} height={5} fill="#1a1a1a"/>
        </svg>
      </div>
    );
  }
  
type EventPosterGeneratorProps = {
    events: EventFromFirestore[];
};

export function EventPosterGenerator({ events }: EventPosterGeneratorProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO);

    useEffect(() => {
        if (!firestore) return;
        async function fetchLogo() {
            const docRef = doc(firestore, "settings", "siteConfig");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.logoUrl) {
                    setLogoUrl(data.logoUrl);
                }
            }
        }
        fetchLogo();
    }, [firestore]);


    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [color, setColor] = useState(COLORS[0].value);
    const [format, setFormat] = useState("instagram");
    const [showQR, setShowQR] = useState(true);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [generated, setGenerated] = useState(false);
    const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
    const [imageHeight, setImageHeight] = useState(30);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const event = events.find(e => e.id === selectedEventId) || null;

    useEffect(() => {
        if (showQR && event) {
            const eventUrl = `${window.location.origin}/events/${event.slug || event.id}`;
            QRCode.toDataURL(eventUrl, { width: 256, margin: 1 })
                .then(url => {
                    setQrCodeDataUrl(url);
                })
                .catch(err => {
                    console.error("QR Code generation failed:", err);
                    toast({ title: 'QR-kode feilet', description: 'Kunne ikke generere QR-kode.', variant: 'destructive' });
                    setQrCodeDataUrl(null);
                });
        } else {
            setQrCodeDataUrl(null);
        }
    }, [showQR, event, toast]);


    const handleFileSelect = (files: SelectedFile[]) => {
        if (files.length > 0) {
            setUploadedImage(files[0].url);
            setGenerated(false);
        }
        setIsFileExplorerOpen(false);
    };

    function handleDownload() {
        if (!svgRef.current) return;
        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `arkitekturopproret-${format}-${selectedEventId}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    const sectionLabel = (n: number, txt: string) => (
        <Label className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-2 block">{n}. {txt}</Label>
    );

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Plakatgenerator</CardTitle>
                    <CardDescription>Generer en enkel plakat for arrangementet ditt.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            {sectionLabel(1, "Velg arrangement")}
                            <Select value={selectedEventId || ""} onValueChange={id => { setSelectedEventId(id); setGenerated(false); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="— Velg eit arrangement —" />
                                </SelectTrigger>
                                <SelectContent>
                                    {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            {sectionLabel(2, "Bakgrunnsfarge")}
                            <RadioGroup value={color} onValueChange={(c) => {setColor(c); setGenerated(false)}} className="flex gap-4">
                                {COLORS.map(c => (
                                    <div key={c.value} className="flex flex-col items-center gap-2">
                                        <RadioGroupItem value={c.value} id={c.value} className="sr-only" />
                                        <Label htmlFor={c.value} className="cursor-pointer">
                                            <div style={{ backgroundColor: c.value }} className={cn("w-12 h-12 rounded-lg border-2", color === c.value ? 'border-primary' : `border-[${c.border}]`)} />
                                        </Label>
                                        <span className="text-xs text-muted-foreground">{c.label}</span>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                        
                        <div>
                            {sectionLabel(3, "Format")}
                            <RadioGroup value={format} onValueChange={f => {setFormat(f); setGenerated(false);}} className="space-y-2">
                                {FORMATS.map(f => (
                                    <Label key={f.id} htmlFor={f.id} className={cn("flex justify-between items-center p-4 rounded-lg border cursor-pointer", format === f.id ? "border-primary bg-primary/5" : "border-border bg-transparent")}>
                                        <div>
                                            <p className="font-semibold">{f.label}</p>
                                            <p className="text-sm text-muted-foreground">{f.sub}</p>
                                        </div>
                                        <RadioGroupItem value={f.id} id={f.id} />
                                    </Label>
                                ))}
                            </RadioGroup>
                        </div>
                        
                        <div>
                            {sectionLabel(4, "Legg til bilde")}
                            <Button onClick={() => setIsFileExplorerOpen(true)} variant="outline" className="w-full">
                                <FolderOpen className="mr-2 h-4 w-4"/>
                                {uploadedImage ? "Bytt bilde" : "Velg bilde (valgfritt)"}
                            </Button>

                            {uploadedImage && (
                                <div className="space-y-4 mt-4">
                                    <Button onClick={() => { setUploadedImage(null); setGenerated(false); }} variant="ghost" size="sm" className="w-full text-destructive">
                                    Fjern bilde
                                    </Button>
                                    <div className="space-y-2 pt-4 border-t">
                                        <Label htmlFor="image-height-slider">Bildehøyde ({imageHeight}%)</Label>
                                        <Slider
                                            id="image-height-slider"
                                            min={10}
                                            max={70}
                                            step={1}
                                            value={[imageHeight]}
                                            onValueChange={(value) => {
                                                setImageHeight(value[0]);
                                                setGenerated(false);
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div>
                            {sectionLabel(5, "QR-kode på plakaten?")}
                            <div className="flex items-center space-x-2">
                                <Switch id="qr-toggle" checked={showQR} onCheckedChange={(c) => {setShowQR(c); setGenerated(false);}} />
                                <Label htmlFor="qr-toggle">{showQR ? "Ja" : "Nei"}</Label>
                            </div>
                        </div>

                        <Button onClick={() => { if (selectedEventId) setGenerated(true); }} disabled={!selectedEventId} className="w-full">
                            6. Generer plakat
                        </Button>

                        {generated && (
                            <Button onClick={handleDownload} variant="secondary" className="w-full">
                                <Download className="mr-2 h-4 w-4" />
                                Last ned (SVG)
                            </Button>
                        )}
                    </div>
                    
                    <div className="pt-10">
                        {generated ? (
                            <PosterCanvas 
                                event={event} 
                                color={color} 
                                format={format} 
                                showQR={showQR} 
                                uploadedImage={uploadedImage} 
                                imageHeight={imageHeight}
                                canvasRef={svgRef} 
                                logoUrl={logoUrl}
                                qrCodeDataUrl={qrCodeDataUrl}
                            />
                        ) : (
                            <div className="w-[340px] h-[425px] bg-muted rounded-lg flex items-center justify-center text-center p-4">
                                <div className="text-muted-foreground">
                                    <p className="text-2xl mb-2">🖼️</p>
                                    <p className="font-semibold">Forhåndsvisning av plakat</p>
                                    <p className="text-sm">Gjer valga dine i panelet til venstre, og trykk på "Generer plakat".</p>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
            <Dialog open={isFileExplorerOpen} onOpenChange={setIsFileExplorerOpen}>
                <DialogContent className="sm:max-w-7xl h-[80vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>Velg et bilde</DialogTitle>
                        <DialogDescription>
                            Velg et bilde for plakaten.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-grow min-h-0">
                        <FileExplorer onFileSelect={handleFileSelect} isDialog={true} />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}