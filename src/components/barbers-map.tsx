
'use client';

import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import type { GeoPoint } from '@/lib/types';

export interface MapLocation {
    id: string;
    position: GeoPoint;
    label: string;
    type: 'barber' | 'client';
}

interface BarbersMapProps {
    apiKey: string;
    locations: MapLocation[];
    center: GeoPoint | null;
    zoom?: number;
}

export function BarbersMap({ apiKey, locations, center, zoom = 12 }: BarbersMapProps) {
    if (!apiKey) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-muted text-muted-foreground">
                <p>Chave da API do Google Maps não configurada.</p>
            </div>
        );
    }
    
    const mapCenter = center || { lat: -23.55052, lng: -46.633308 }; // Default to São Paulo

    return (
        <APIProvider apiKey={apiKey}>
            <Map
                style={{ width: '100%', height: '100%' }}
                defaultCenter={mapCenter}
                center={mapCenter}
                defaultZoom={zoom}
                zoom={zoom}
                gestureHandling={'greedy'}
                disableDefaultUI={true}
                mapId="barberflow-map"
            >
                {locations.map(location => (
                    <AdvancedMarker key={location.id} position={location.position} title={location.label}>
                        <Pin 
                            background={location.type === 'barber' ? '#ef4444' : '#3b82f6'}
                            borderColor={location.type === 'barber' ? '#b91c1c' : '#1d4ed8'}
                            glyphColor={location.type === 'barber' ? '#ffffff' : '#ffffff'}
                        />
                    </AdvancedMarker>
                ))}
            </Map>
        </APIProvider>
    );
}

