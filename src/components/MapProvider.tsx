import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { LoadScript } from '@react-google-maps/api';

interface MapContextType {
  isGoogleMaps: boolean;
  isLoaded: boolean;
  apiKey: string;
}

const MapContext = createContext<MapContextType>({
  isGoogleMaps: false,
  isLoaded: true,
  apiKey: '',
});

export const useMapContext = () => useContext(MapContext);

const GOOGLE_MAPS_LIBRARIES: ('places' | 'geometry' | 'drawing')[] = ['places', 'geometry'];

interface MapProviderProps {
  children: ReactNode;
}

export const MapProvider: React.FC<MapProviderProps> = ({ children }) => {
  const [gmAuthFailed, setGmAuthFailed] = useState(false);

  const rawApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
  
  // Validar si es una API Key real de Google Maps y no una plantilla / ejemplo
  const isValidGoogleMapsKey = Boolean(
    rawApiKey &&
    typeof rawApiKey === 'string' &&
    rawApiKey.trim().length > 20 &&
    !rawApiKey.includes('AIzaSyA5ninvK3y0I7j3kQ6lKASoQpXHOxX4q-w') &&
    !rawApiKey.includes('YOUR_KEY') &&
    !rawApiKey.includes('MY_KEY') &&
    !gmAuthFailed
  );

  useEffect(() => {
    // Escuchar si Google Maps falla al autenticarse en tiempo de ejecución
    const previousAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      setGmAuthFailed(true);
      if (typeof previousAuthFailure === 'function') {
        previousAuthFailure();
      }
    };
    return () => {
      (window as any).gm_authFailure = previousAuthFailure;
    };
  }, []);

  const isGoogleMaps = isValidGoogleMapsKey && !gmAuthFailed;

  return (
    <MapContext.Provider
      value={{
        isGoogleMaps,
        isLoaded: true,
        apiKey: isGoogleMaps ? rawApiKey : '',
      }}
    >
      {isGoogleMaps ? (
        <LoadScript googleMapsApiKey={rawApiKey} libraries={GOOGLE_MAPS_LIBRARIES}>
          {children}
        </LoadScript>
      ) : (
        children
      )}
    </MapContext.Provider>
  );
};

export default MapProvider;
