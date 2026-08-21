import React, { useState, useEffect, useMemo } from 'react';
import { Star, AlertTriangle, X, CheckCircle2, MessageSquare, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface CalificacionModalProps {
  isOpen: boolean;
  selectedTrip: {
    id: string;
    conductorId: string;
    conductorNombre?: string;
    fecha_aceptacion?: string;
    fecha_llegando?: string;
    fecha_finalizacion?: string;
    tiempo_llegada?: number;
    [key: string]: any;
  } | null;
  onClose: () => void;
  onSubmit: (ratingData: { estrellas: number; comentario: string }) => Promise<void> | void;
  isSubmitting?: boolean;
}

export const CalificacionModal: React.FC<CalificacionModalProps> = ({
  isOpen,
  selectedTrip,
  onClose,
  onSubmit,
  isSubmitting = false
}) => {
  const [estrellas, setEstrellas] = useState<number>(5);
  const [comentario, setComentario] = useState<string>('');
  const [hoverEstrellas, setHoverEstrellas] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reiniciar estado cuando cambia el viaje o se abre el modal
  useEffect(() => {
    if (isOpen) {
      setEstrellas(5);
      setComentario('');
      setHoverEstrellas(0);
      setErrorMsg(null);
    }
  }, [isOpen, selectedTrip?.id]);

  // Verificar si hubo retraso en la llegada del conductor
  const isDelayed = useMemo(() => {
    if (!selectedTrip?.fecha_aceptacion || !selectedTrip?.tiempo_llegada) return false;
    const acceptTime = new Date(selectedTrip.fecha_aceptacion).getTime();
    const arrivalTime = new Date(selectedTrip.fecha_llegando || selectedTrip.fecha_finalizacion || Date.now()).getTime();
    const promisedMs = Number(selectedTrip.tiempo_llegada) * 60 * 1000;
    return (arrivalTime - acceptTime) > promisedMs;
  }, [selectedTrip]);

  // Texto descriptivo de la calificación
  const getLabelByRating = (rating: number): string => {
    switch (rating) {
      case 1:
        return 'Muy malo';
      case 2:
        return 'Malo';
      case 3:
        return 'Regular';
      case 4:
        return 'Muy bueno';
      case 5:
        return 'Excelente (5 Estrellas)';
      default:
        return 'Selecciona tu calificación';
    }
  };

  const isTextareaRequired = estrellas < 3;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    // Validación si la calificación es < 3 estrellas
    if (isTextareaRequired && (!comentario.trim() || comentario.trim().length < 10)) {
      setErrorMsg('Por favor escribe un comentario de al menos 10 caracteres explicando qué podemos mejorar.');
      return;
    }

    try {
      await onSubmit({ estrellas, comentario: isTextareaRequired ? comentario.trim() : '' });
    } catch (err: any) {
      console.error('Error al enviar calificación en CalificacionModal:', err);
      setErrorMsg(err?.message || 'Ocurrió un error al guardar tu calificación. Inténtalo nuevamente.');
    }
  };

  if (!isOpen || !selectedTrip) return null;

  return (
    <AnimatePresence key="calificacion-modal-presence">
      <motion.div
        key="calificacion-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 notranslate"
        translate="no"
      >
        <motion.div
          key="calificacion-modal-card"
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl relative border border-slate-100 overflow-hidden"
        >
          {/* Badge obligatorio */}
          <div
            key="badge-obligatorio"
            className="absolute top-4 right-4 flex items-center gap-1.5 bg-amber-500/10 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-500/20"
          >
            <Star size={12} className="fill-amber-500 text-amber-500" />
            <span>Obligatorio</span>
          </div>

          {/* Encabezado */}
          <div key="modal-header" className="text-center mt-2 mb-6">
            <div key="icon-container" className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-500 shadow-sm border border-amber-100">
              <Star size={32} fill="currentColor" className="text-amber-400" />
            </div>

            <h3 key="modal-title" className="text-xl font-black text-slate-900 tracking-tight">
              Califica tu Servicio
            </h3>

            <p key="modal-subtitle" className="text-slate-500 text-xs mt-1.5 leading-relaxed px-1">
              Cuéntanos tu experiencia con{' '}
              <span key="conductor-nombre" className="font-bold text-slate-800">
                {selectedTrip.conductorNombre || 'tu conductor'}
              </span>.
            </p>

            {/* Aviso de retraso */}
            <div key="delayed-notice-container" className="mt-3">
              {isDelayed ? (
                <div key="delayed-box" className="p-3 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-2.5 text-left">
                  <AlertTriangle size={16} className="text-red-500 shrink-0" />
                  <span key="delayed-text" className="text-[11px] font-semibold text-red-700 leading-tight">
                    El conductor sobrepasó el tiempo estimado de {selectedTrip.tiempo_llegada} min.
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Selección de estrellas */}
          <div key="stars-section" className="flex flex-col items-center gap-3 mb-6">
            <div key="stars-row" className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((starIndex) => {
                const activeStar = hoverEstrellas > 0 ? starIndex <= hoverEstrellas : starIndex <= estrellas;
                return (
                  <button
                    key={`star-btn-${starIndex}`}
                    type="button"
                    onClick={() => {
                      setEstrellas(starIndex);
                      setErrorMsg(null);
                    }}
                    onMouseEnter={() => setHoverEstrellas(starIndex)}
                    onMouseLeave={() => setHoverEstrellas(0)}
                    className="p-1 rounded-xl transition-all hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    aria-label={`Calificar con ${starIndex} estrellas`}
                  >
                    <Star
                      key={`star-icon-${starIndex}`}
                      size={36}
                      className={activeStar ? 'text-amber-400 fill-amber-400 drop-shadow-sm' : 'text-slate-200 fill-slate-100'}
                    />
                  </button>
                );
              })}
            </div>

            <span key="rating-label" className="text-xs font-bold text-amber-600 uppercase tracking-wider bg-amber-50 px-3 py-1 rounded-full border border-amber-200/60">
              {getLabelByRating(hoverEstrellas || estrellas)}
            </span>
          </div>

          {/* Formulario de comentario condicional (ternario estricto) */}
          <div key="textarea-container" className="mb-5">
            {isTextareaRequired ? (
              <div key="textarea-wrapper" className="space-y-2">
                <div key="textarea-label-row" className="flex items-center justify-between">
                  <label key="textarea-label" className="text-[11px] uppercase font-bold text-slate-600 flex items-center gap-1">
                    <MessageSquare size={13} className="text-slate-400" />
                    <span>{isDelayed ? 'Motivo del retraso / Comentario' : '¿Qué podemos mejorar?'}</span>
                  </label>
                  <span key="required-tag" className="text-[10px] text-red-500 font-bold uppercase">
                    * Requerido
                  </span>
                </div>

                <textarea
                  key="comentario-textarea"
                  required={isTextareaRequired}
                  value={comentario}
                  onChange={(e) => {
                    setComentario(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder={
                    isDelayed
                      ? 'Por favor explica la demora o lo sucedido con el servicio...'
                      : 'Cuéntanos qué sucedió para ayudarnos a mejorar el servicio...'
                  }
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-2xl p-3.5 text-xs text-slate-800 outline-none min-h-[90px] resize-none transition-all shadow-inner"
                  translate="no"
                />
              </div>
            ) : null}
          </div>

          {/* Mensaje de error */}
          <div key="error-container" className="mb-4">
            {errorMsg ? (
              <div key="error-box" className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0 text-red-500" />
                <span key="error-msg-text">{errorMsg}</span>
              </div>
            ) : null}
          </div>

          {/* Botón de Enviar */}
          <button
            key="submit-btn"
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin text-amber-400" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>Enviar Calificación</span>
              </>
            )}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CalificacionModal;
