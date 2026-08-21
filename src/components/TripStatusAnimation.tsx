import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Car, MapPin, CheckCircle2, Navigation, Clock, Circle } from 'lucide-react';

interface TripStatusAnimationProps {
  status: 'solicitado' | 'negociando' | 'aceptado' | 'en_camino' | 'llegando' | 'en_transito' | 'finalizado' | 'cancelado';
  role: 'conductor' | 'pasajero';
}

export const TripStatusAnimation: React.FC<TripStatusAnimationProps> = ({ status, role }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'aceptado':
        return {
          icon: <CheckCircle2 className="text-emerald-500" size={20} />,
          text: role === 'pasajero' ? 'Conductor asignado' : 'Viaje aceptado',
          color: 'bg-emerald-500',
          progress: 20,
          pulseColor: 'rgba(16, 185, 129, 0.2)'
        };
      case 'en_camino':
        return {
          icon: <Car className="text-blue-500" size={20} />,
          text: role === 'pasajero' ? 'El conductor va en camino' : 'Yendo al origen',
          color: 'bg-blue-500',
          progress: 40,
          pulseColor: 'rgba(59, 130, 246, 0.2)'
        };
      case 'llegando':
        return {
          icon: <MapPin className="text-amber-500" size={20} />,
          text: role === 'pasajero' ? '¡Conductor en el punto!' : 'Has llegado al origen',
          color: 'bg-amber-500',
          progress: 65,
          pulseColor: 'rgba(245, 158, 11, 0.2)'
        };
      case 'en_transito':
        return {
          icon: <Navigation className="text-slate-800" size={20} />,
          text: 'Viaje en progreso',
          color: 'bg-slate-800',
          progress: 90,
          pulseColor: 'rgba(30, 41, 59, 0.2)'
        };
      case 'finalizado':
        return {
          icon: <CheckCircle2 className="text-emerald-600" size={20} />,
          text: 'Servicio completado',
          color: 'bg-emerald-600',
          progress: 100,
          pulseColor: 'transparent'
        };
      default:
        return {
          icon: <Clock className="text-slate-400" size={20} />,
          text: 'Sincronizando...',
          color: 'bg-slate-400',
          progress: 5,
          pulseColor: 'rgba(148, 163, 184, 0.1)'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="w-full bg-white/50 backdrop-blur-sm rounded-3xl p-4 border border-slate-100 flex flex-col gap-3 relative overflow-hidden">
      {/* Glossy overlay effect */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <motion.div 
            key={status + 'icon'}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-slate-50 flex items-center justify-center relative"
          >
            {config.icon}
            {status !== 'finalizado' && (
              <motion.div 
                animate={{ scale: [1, 1.5, 1.8], opacity: [0.5, 0.2, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 rounded-2xl"
                style={{ backgroundColor: config.pulseColor }}
              />
            )}
          </motion.div>
          
          <div className="flex flex-col">
            <motion.span 
              key={status + 'text'}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="text-xs font-black text-slate-800 uppercase tracking-tight"
            >
              {config.text}
            </motion.span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Estado: {status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
           <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[8px] font-black text-slate-400 uppercase">Live</span>
        </div>
      </div>

      {/* Modern Progress Track */}
      <div className="relative h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${config.progress}%` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full ${config.color} relative shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
        >
          {/* Animated light streak */}
          <motion.div 
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-20"
          />
        </motion.div>
      </div>

      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Punto de inicio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Destino final</span>
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        </div>
      </div>
    </div>
  );
};

