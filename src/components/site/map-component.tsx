
"use client";

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import Image from 'next/image';
import Link from 'next/link';
import ReactDOMServer from 'react-dom/server';
import type { Building } from '@/types/building';


// Manager class to handle Leaflet instance outside of React's lifecycle
class MapManager {
    private map: L.Map | null = null;
    private tileLayer: L.TileLayer | null = null;
    private markerClusterGroup: L.MarkerClusterGroup | null = null;

    init(container: HTMLElement, buildings: Building[]) {
        if (this.map) {
            return;
        }

        const isSingleBuilding = buildings.length === 1 && buildings[0].latitude && buildings[0].longitude;

        const center: L.LatLngExpression = isSingleBuilding
            ? [buildings[0].latitude!, buildings[0].longitude!]
            : [60.3913, 5.3221];
        
        const zoom = isSingleBuilding ? 17 : 14;

        this.map = L.map(container, {
            center: center,
            zoom: zoom,
        });

        this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(this.map);

        this.markerClusterGroup = L.markerClusterGroup();

        const createIcon = (category: string) => {
            let colorClass = "bg-gray-500"; // default
            if (category === "Vakkert") colorClass = "bg-green-500";
            else if (category === "Stygt") colorClass = "bg-red-500";
            else if (category === "OK+" || category === "OK-") colorClass = "bg-yellow-500";

            return L.divIcon({
                html: `<div class="relative flex items-center justify-center w-6 h-6 rounded-full ${colorClass} border-2 border-white shadow-md"></div>`,
                className: "custom-leaflet-icon",
                iconSize: [24, 24],
                iconAnchor: [12, 12],
            });
        };

        buildings.forEach((building) => {
            if (building.latitude && building.longitude) {
                const imageUrl = building.imageUrls?.[0];
                const popupContent = ReactDOMServer.renderToString(
                    <div className="w-48">
                        {imageUrl && (
                            <div className="relative aspect-video mb-2">
                                <Image
                                    src={imageUrl}
                                    alt={building.name}
                                    fill
                                    className="object-cover rounded-md w-full h-full"
                                    unoptimized
                                />
                            </div>
                        )}
                        <h3 className="font-bold font-headline text-base mb-1">
                            <Link href={`/buildings/${building.slug || building.id}`} className="hover:underline">
                                {building.name}
                            </Link>
                        </h3>
                        <p className="text-xs text-gray-500 mb-2">
                            {building.address}
                        </p>
                    </div>
                );

                const marker = L.marker([building.latitude, building.longitude], {
                    icon: createIcon(building.category || 'ukjent'),
                });
                marker.bindPopup(popupContent);
                this.markerClusterGroup!.addLayer(marker);
            }
        });

        this.map.addLayer(this.markerClusterGroup);
    }

    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }
}

const MapComponent = ({ buildings }: { buildings: Building[] }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapManagerRef = useRef<MapManager | null>(null);

    useEffect(() => {
        if (mapContainerRef.current) {
            if (!mapManagerRef.current) {
                mapManagerRef.current = new MapManager();
            }
            mapManagerRef.current.init(mapContainerRef.current, buildings);
        }

        // Cleanup function
        return () => {
            if (mapManagerRef.current) {
                mapManagerRef.current.destroy();
                mapManagerRef.current = null;
            }
        };
    }, [buildings]); // Rerun effect if buildings change

    // Add position: 'relative' and zIndex: 0 to contain the map layers
    return <div ref={mapContainerRef} style={{ height: '100%', width: '100%', position: 'relative', zIndex: 0 }} />;
};

export default MapComponent;
