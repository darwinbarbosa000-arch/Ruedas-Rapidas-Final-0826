import React, { useState } from 'react';

export interface DriverOfferModalProps {
  service: any;
  onClose: () => void;
  onSendOffer: (price: number, time: number) => void;
  driverBalance?: number;
  onRequestRecharge?: () => void;
}

export default function DriverOfferModal({ service, onClose, onSendOffer, driverBalance, onRequestRecharge }: DriverOfferModalProps) {
  const basePrice = service?.valor || service?.basePrice || 5000;
  const currencySymbol = service?.currencySymbol || '$';
  const commissionRate = 0.08; // 8%
  
  const [selectedPrice, setSelectedPrice] = useState(basePrice + 2000);
  const [selectedTime, setSelectedTime] = useState(5);
  
  const quickPrices = [
    { label: 'BASE', value: basePrice },
    { label: '+1000', value: basePrice + 1000 },
    { label: '+2000', value: basePrice + 2000 },
    { label: '+5000', value: basePrice + 5000 },
  ];
  
  const times = [3, 5, 8, 10, 15];
  const commission = Math.round(selectedPrice * commissionRate);
  const totalToCollect = selectedPrice; // 100% para el conductor
  const currentBalance = driverBalance !== undefined ? driverBalance : 133000;
  const hasEnoughBalance = currentBalance >= commission;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[110] p-0 sm:p-4">
      <div className="bg-white w-full sm:w-[420px] rounded-t-3xl sm:rounded-2xl p-4 pb-6 max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
          <div>
            <p className="text-sm text-gray-500 font-medium">Tarifa del pasajero</p>
            <p className="text-2xl font-bold text-gray-900">{currencySymbol} {basePrice.toLocaleString()} COP</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 text-2xl font-light w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* SECCIÓN 1: AJUSTA TU PRECIO */}
        <div className="mb-5">
          <p className="text-sm font-semibold mb-2 text-gray-800">¿Cuánto ofreces?</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {quickPrices.map(p => (
              <button 
                type="button"
                key={p.label + p.value}
                onClick={() => setSelectedPrice(p.value)}
                className={`p-2 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  selectedPrice === p.value 
                  ? 'border-green-500 bg-green-50 text-green-900' 
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                <p className="text-[11px] text-gray-500 font-medium">{p.label}</p>
                <p className="font-bold text-sm">{currencySymbol} {p.value.toLocaleString()}</p>
              </button>
            ))}
          </div>
          
          {/* INPUT PERSONALIZADO */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-green-600 select-none">{currencySymbol}</span>
            <input 
              type="number"
              step="500"
              min="5000"
              value={selectedPrice || ''}
              onChange={(e) => setSelectedPrice(Number(e.target.value) || 0)}
              className="w-full pl-10 pr-4 py-3.5 border-2 border-gray-200 rounded-xl text-2xl font-bold focus:border-green-500 outline-none text-gray-900 bg-white"
            />
          </div>
        </div>

        {/* SECCIÓN 2: TIEMPO DE LLEGADA */}
        <div className="mb-5">
          <p className="text-sm font-semibold mb-2 text-gray-800">¿En cuántos minutos llegas?</p>
          <div className="flex gap-2 justify-between">
            {times.map(t => (
              <button 
                type="button"
                key={t}
                onClick={() => setSelectedTime(t)}
                className={`flex-1 py-2 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedTime === t 
                  ? 'bg-black text-white border-black font-bold' 
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <p className="font-bold text-lg leading-tight">{t}</p>
                <p className="text-[10px] uppercase font-bold tracking-wider">MIN</p>
              </button>
            ))}
          </div>
        </div>

        {/* UI NUEVA - RESUMEN DE PAGO */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">El pasajero te paga en efectivo</span>
            <span className="font-bold text-lg text-black">{currencySymbol} {totalToCollect.toLocaleString()} COP</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Comisión Ruedas Rápidas 8%</span>
            <span className="text-sm text-red-500 font-semibold">- {currencySymbol} {commission.toLocaleString()} COP</span>
          </div>

          <div className="border-t border-gray-200 pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Se cobrará de tu saldo al aceptar</span>
              <span className="text-xs text-red-600 font-bold">{currencySymbol} {commission.toLocaleString()} COP</span>
            </div>
          </div>
        </div>

        {/* MENSAJE DE ADVERTENCIA */}
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 mb-4">
          <p className="text-xs text-yellow-800">
            ⚠️ Recibirás {currencySymbol}{selectedPrice.toLocaleString()} en efectivo. 
            La comisión de {currencySymbol}{commission.toLocaleString()} se descontará de tu saldo ahora.
          </p>
        </div>

        {/* SALDO */}
        <div className="flex items-center justify-between gap-2 bg-green-50 text-green-800 border border-green-200 rounded-xl p-3 mb-4 text-sm font-medium">
          <div className="flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <span>Saldo disponible: {currencySymbol} {currentBalance.toLocaleString()} COP</span>
          </div>
          {!hasEnoughBalance && onRequestRecharge && (
            <button 
              type="button" 
              onClick={onRequestRecharge}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1 rounded-lg transition-colors shadow-xs"
            >
              Recargar
            </button>
          )}
        </div>

        {/* BOTON PRINCIPAL */}
        <button 
          type="button"
          onClick={() => onSendOffer(selectedPrice, selectedTime)}
          disabled={!hasEnoughBalance || selectedPrice < 5000}
          className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
            !hasEnoughBalance || selectedPrice < 5000
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
            : 'bg-green-500 hover:bg-green-600 active:scale-[0.99] text-white shadow-lg shadow-green-200'
          }`}
        >
          ✓ ENVIAR OFERTA POR {currencySymbol} {selectedPrice.toLocaleString()} ({selectedTime} MIN)
        </button>
      </div>
    </div>
  );
}
