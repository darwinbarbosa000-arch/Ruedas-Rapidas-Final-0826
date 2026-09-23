import React from 'react';
import { EnCaminoMap } from './EnCaminoMap';

export interface RidePoint {
  lat?: number;
  lng?: number;
  address?: string;
  name?: string;
}

export interface RideTrackerProps {
  driverId: string;
  driverName?: string;
  vehicleType?: string;
  passengerPoint?: RidePoint | null;
  destinationPoint?: RidePoint | null;
  status?: string;
  className?: string;
}

export const RideTracker: React.FC<RideTrackerProps> = ({
  driverId,
  driverName = 'Darwin Barbosa',
  vehicleType = 'car',
  passengerPoint = null,
  destinationPoint = null,
  status = 'EN_CAMINO_A_RECOGIDA',
  className = 'w-full h-[400px] sm:h-[450px]',
}) => {
  // Coordenada segura de recogida (Punto de Recogida)
  const recogidaPos = {
    lat: typeof passengerPoint?.lat === 'number' && !isNaN(passengerPoint.lat) ? passengerPoint.lat : 4.3364,
    lng: typeof passengerPoint?.lng === 'number' && !isNaN(passengerPoint.lng) ? passengerPoint.lng : -74.3638,
    address: passengerPoint?.address || 'Universidad',
    name: passengerPoint?.name || (passengerPoint?.address ? passengerPoint.address.split(',')[0] : 'Universidad'),
  };

  // Coordenada de destino (Solo se mostrará si estado cambia a EN_VIAJE)
  const destinoPos = destinationPoint && typeof destinationPoint.lat === 'number' && !isNaN(destinationPoint.lat) ? {
    lat: destinationPoint.lat,
    lng: destinationPoint.lng as number,
    address: destinationPoint.address || 'Destino',
    name: destinationPoint.name || (destinationPoint?.address ? destinationPoint.address.split(',')[0] : 'Destino Final'),
  } : null;

  return (
    <div className="w-full notranslate" translate="no">
      <EnCaminoMap
        driverId={driverId}
        driverName={driverName}
        vehicleType={vehicleType}
        recogidaPos={recogidaPos}
        destinoPos={destinoPos}
        estado={status}
        className={className}
        autoSimulateIfOffline={true}
      />
    </div>
  );
};

export { EnCaminoMap };
export default RideTracker;
