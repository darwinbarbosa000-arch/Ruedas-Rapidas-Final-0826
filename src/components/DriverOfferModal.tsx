import React, { useState } from 'react';

export interface DriverOfferModalProps {
  service: any;
  onClose: () => void;
  onSendOffer: (price: number, time: number) => void;
  driverBalance?: number;
  onRequestRecharge?: () => void;
}

export default function DriverOfferModal({ service, onClose, onSendOffer, driverBalance, onRequestRecharge }: DriverOfferModalProps) {
  const isSpecialCargo = 
    ['camion_flete', 'camion_acarreo', 'motocarro'].includes(service?.tipo) ||
    service?.tarifa_libre === true ||
    service?.servicio_especial === true;

  const cargoLabel = service?.tipo === 'camion_flete' 
    ? 'Flete' 
    : service?.tipo === 'camion_acarreo' 
      ? 'Acarreo' 
      : service?.tipo === 'motocarro' 
        ? 'Moto Carro' 
        : 'Carga';

  const basePrice = service?.valor || service?.basePrice || (isSpecialCargo ? 0 : 5000);
  const currencySymbol = service?.currencySymbol || '$';
  const commissionRate = 0.08; // 8% de comisión estándar
  
  const [selectedPrice, setSelectedPrice] = useState(
    isSpecialCargo 
      ? (basePrice > 0 ? basePrice : 45000) 
      : (basePrice + 2000)
  );
  const [selectedTime, setSelectedTime] = useState(5);
  
  const quickPrices = isSpecialCargo
    ? (basePrice > 0
        ? [
            { label: 'BASE', value: basePrice },
            { label: '+10K', value: basePrice + 10000 },
            { label: '+25K', value: basePrice + 25000 },
            { label: '+50K', value: basePrice + 50000 },
          ]
        : [
            { label: '30K', value: 30000 },
            { label: '60K', value: 60000 },
            { label: '120K', value: 120000 },
            { label: '250K', value: 250000 },
          ]
      )
    : [
        { label: 'BASE', value: basePrice },
        { label: '+1000', value: basePrice + 1000 },
        { label: '+2000', value: basePrice + 2000 },
        { label: '+5000', value: basePrice + 5000 },
      ];
  
  const times = [3, 5, 8, 10, 15];
  const commission = Math.round(selectedPrice * commissionRate);
  const netEarnings = selectedPrice - commission; // 92% para el conductor
  const totalToCollect = selectedPrice; // 100% que paga el usuario
  const currentBalance = driverBalance !== undefined ? driverBalance : 133000;
  const hasEnoughBalance = currentBalance >= commission;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center z-[110] p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full sm:w-[440px] rounded-t-3xl sm:rounded-3xl p-5 pb-6 max-h-[92vh] overflow-y-auto shadow-2xl relative animate-in fade-in slide-in-from-bottom duration-200 border border-slate-100">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                Comisión 8%
              </span>
              {isSpecialCargo ? (
                <span className="text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-800 px-2 py-0.5 rounded-md">
                  {cargoLabel}
                </span>
              ) : (
                <p className="text-xs text-slate-500 font-medium">Tarifa del pasajero</p>
              )}
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {basePrice > 0 ? (
                <>
                  {currencySymbol} {basePrice.toLocaleString()} <span className="text-xs font-bold text-slate-400">COP</span>
                </>
              ) : (
                <span className="text-orange-600 text-lg uppercase tracking-tight">Tarifa a convenir</span>
              )}
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 text-2xl font-light w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Cerrar modal de oferta"
          >
            ×
          </button>
        </div>

        {/* SECCIÓN 1: AJUSTA TU PRECIO */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {isSpecialCargo ? `¿Cuánto vas a cobrar por este ${cargoLabel}?` : '¿Cuánto ofreces al pasajero?'}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {quickPrices.map((p, pIdx) => (
              <button 
                type="button"
                key={`quick-price-${p.label}-${p.value}-${pIdx}`}
                onClick={() => setSelectedPrice(p.value)}
                className={`p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  selectedPrice === p.value 
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs' 
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <p className="text-[10px] text-slate-500 font-bold uppercase">{p.label}</p>
                <p className="font-black text-xs sm:text-sm">{currencySymbol} {p.value.toLocaleString()}</p>
              </button>
            ))}
          </div>
          
          {/* INPUT PERSONALIZADO */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-600 select-none">{currencySymbol}</span>
            <input 
              type="number"
              step={isSpecialCargo ? "1000" : "500"}
              min={isSpecialCargo ? "1" : "4000"}
              value={selectedPrice || ''}
              onChange={(e) => setSelectedPrice(Number(e.target.value) || 0)}
              placeholder="Ingresa tu tarifa"
              className="w-full pl-10 pr-4 py-3.5 border-2 border-slate-200 focus:border-emerald-500 rounded-2xl text-2xl font-black outline-none text-slate-900 bg-slate-50/50 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* SECCIÓN 2: TIEMPO DE LLEGADA */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider mb-2 text-slate-700">¿En cuántos minutos llegas?</p>
          <div className="flex gap-2 justify-between">
            {times.map((t, tIdx) => (
              <button 
                type="button"
                key={`time-opt-${t}-${tIdx}`}
                onClick={() => setSelectedTime(t)}
                className={`flex-1 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedTime === t 
                  ? 'bg-slate-900 text-white border-slate-900 font-black shadow-md' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="font-black text-base leading-tight">{t}</p>
                <p className="text-[9px] uppercase font-bold tracking-wider">MIN</p>
              </button>
            ))}
          </div>
        </div>

        {/* UI DESGLOSE DE COMISIÓN (8%) Y GANANCIA NETA */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 mb-4 space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-600 font-medium">Cobro total al usuario:</span>
            <span className="font-black text-base text-slate-900">{currencySymbol} {totalToCollect.toLocaleString()} COP</span>
          </div>
          
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 font-medium">Comisión de plataforma</span>
              <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">8%</span>
            </div>
            <span className="text-sm text-rose-600 font-black">- {currencySymbol} {commission.toLocaleString()} COP</span>
          </div>

          <div className="border-t border-slate-200/80 pt-2.5 mt-1 flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-slate-800">Tu ganancia neta estimada:</span>
              <p className="text-[10px] text-slate-400 font-medium">92% libre para el conductor</p>
            </div>
            <span className="text-base text-emerald-600 font-black">{currencySymbol} {netEarnings.toLocaleString()} COP</span>
          </div>
        </div>

        {/* MENSAJE DE ADVERTENCIA */}
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-xl p-3 mb-4 flex items-start gap-2.5">
          <span className="text-sm">💡</span>
          <p className="text-[11px] text-amber-900 leading-snug font-medium">
            Recibirás <strong className="font-bold text-amber-950">{currencySymbol}{selectedPrice.toLocaleString()} COP</strong> directamente del usuario. 
            La comisión del <strong className="font-bold text-amber-950">8% ({currencySymbol}{commission.toLocaleString()} COP)</strong> se descontará automáticamente de tu Tarjeta Virtual una vez el usuario acepte el servicio.
          </p>
        </div>

        {/* ESTADO DEL SALDO EN TARJETA VIRTUAL */}
        <div className={`flex items-center justify-between gap-2 border rounded-2xl p-3.5 mb-4 text-xs font-medium transition-all ${
          hasEnoughBalance 
          ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
          : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-base">{hasEnoughBalance ? '🛡️' : '⚠️'}</span>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500">Saldo disponible en Tarjeta Virtual</p>
              <p className="font-black text-sm">{currencySymbol} {currentBalance.toLocaleString()} COP</p>
            </div>
          </div>
          {!hasEnoughBalance && onRequestRecharge && (
            <button 
              type="button" 
              onClick={onRequestRecharge}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-black px-3.5 py-1.5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              Recargar Saldo
            </button>
          )}
        </div>

        {/* BOTON PRINCIPAL */}
        <button 
          type="button"
          onClick={() => onSendOffer(selectedPrice, selectedTime)}
          disabled={!hasEnoughBalance || (isSpecialCargo ? selectedPrice <= 0 : selectedPrice < 4000)}
          className={`w-full font-black text-xs uppercase tracking-wider py-4 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
            !hasEnoughBalance || (isSpecialCargo ? selectedPrice <= 0 : selectedPrice < 4000)
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-emerald-200 hover:shadow-emerald-300'
          }`}
        >
          ✓ ENVIAR OFERTA POR {currencySymbol} {selectedPrice.toLocaleString()} ({selectedTime} MIN)
        </button>
      </div>
    </div>
  );
}
