import React from 'react';
import { EnCaminoMap, LocationPoint } from './EnCaminoMap';

export interface RidePoint {
  lat?: number;
  lng?: number;
  address?: string;
  name?: string;
}

export interface RideTrackerProps {
  driverId?: string;
  driverName?: string;
  vehicleType?: string;
  passengerPoint?: RidePoint | null;
  destinationPoint?: RidePoint | null;
  driverPoint?: RidePoint | null;
  status?: string;
  className?: string;
}

export const RideTracker: React.FC<RideTrackerProps> = ({
  driverId,
  driverName = 'Darwin Barbosa',
  vehicleType = 'car',
  passengerPoint = null,
  destinationPoint = null,
  driverPoint = null,
  status = 'EN_CAMINO_A_RECOGIDA',
  className = 'w-full h-[400px] sm:h-[450px]',
}) => {
  // Coordenada segura de recogida (Punto de Recogida)
  const recogidaPos: LocationPoint = {
    lat: typeof passengerPoint?.lat === 'number' && !isNaN(passengerPoint.lat) ? passengerPoint.lat : 4.3364,
    lng: typeof passengerPoint?.lng === 'number' && !isNaN(passengerPoint.lng) ? passengerPoint.lng : -74.3638,
    address: passengerPoint?.address || 'Punto de Recogida',
    name: passengerPoint?.name || (passengerPoint?.address ? passengerPoint.address.split(',')[0] : 'Punto de Recogida'),
  };

  // Coordenada de destino (Solo se mostrará si estado cambia a EN_VIAJE / en_transito)
  const destinoPos: LocationPoint | null =
    destinationPoint && typeof destinationPoint.lat === 'number' && !isNaN(destinationPoint.lat)
      ? {
          lat: destinationPoint.lat,
          lng: destinationPoint.lng as number,
          address: destinationPoint.address || 'Destino',
          name:
            destinationPoint.name ||
            (destinationPoint?.address ? destinationPoint.address.split(',')[0] : 'Destino Final'),
        }
      : null;

  // Coordenada del conductor si viene del cálculo o tracking central
  const driverPos: LocationPoint | null =
    driverPoint && typeof driverPoint.lat === 'number' && !isNaN(driverPoint.lat)
      ? {
          lat: driverPoint.lat,
          lng: driverPoint.lng as number,
          address: driverPoint.address || 'Conductor',
          name: driverPoint.name || 'Conductor',
        }
      : null;

  return (
    <div className="w-full notranslate" translate="no">
      <EnCaminoMap
        driverId={driverId}
        driverName={driverName}
        vehicleType={vehicleType}
        driverPos={driverPos}
        recogidaPos={recogidaPos}
        destinoPos={destinoPos}
        estado={status}
        className={className}
        autoSimulateIfOffline={true}
      />
    </div>
  );
};

export default RideTracker;
