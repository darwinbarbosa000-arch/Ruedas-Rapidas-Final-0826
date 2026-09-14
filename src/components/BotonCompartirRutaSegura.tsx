import React, { useState } from 'react';
import { ShieldCheck, Share2, Copy, ExternalLink, Check, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { compartirViajeSeguro } from '../services/viajeCompartidoService';

interface BotonCompartirRutaSeguraProps {
  viaje: any;
  user: any;
  perfil?: any;
  className?: string;
  variant?: 'banner' | 'button' | 'compact';
  onOpenTrackingView?: (viajeId: string) => void;
}

export const BotonCompartirRutaSegura: React.FC<BotonCompartirRutaSeguraProps> = ({
  viaje,
  user,
  perfil,
  className = '',
  variant = 'button',
  onOpenTrackingView,
}) => {
  const [sharing, setSharing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareData, setShareData] = useState<{
    officialLink: string;
    previewLink: string;
    message: string;
  } | null>(null);

  const handleShare = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!viaje || !viaje.id) {
      toast.error('No se puede compartir: viaje no activo');
      return;
    }

    setSharing(true);
    try {
      const data = await compartirViajeSeguro(viaje, user, perfil);
      setShareData(data);
      setShowModal(true);
      toast.success('Ruta segura generada. ¡Enviando por WhatsApp!');
    } catch (error) {
      console.error('Error al compartir ruta segura:', error);
      toast.error('Error al generar enlace seguro');
    } finally {
      setSharing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('¡Enlace copiado al portapapeles!');
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      toast.error('No se pudo copiar automáticamente');
    }
  };

  return (
    <>
      {variant === 'banner' ? (
        <div className="bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 text-white p-3.5 rounded-2xl shadow-md border border-emerald-400/40 flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 text-white shadow-inner">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-100 block">
                Protección en Vivo
              </span>
              <p className="text-xs font-black truncate">
                Comparte tu trayecto con un contacto de confianza
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="px-3 py-2 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Share2 size={13} />
            <span>{sharing ? 'Generando...' : 'Compartir'}</span>
          </button>
        </div>
      ) : variant === 'compact' ? (
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          title="Compartir mi ruta segura por WhatsApp"
          className={`py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-[0.98] cursor-pointer ${className}`}
        >
          <ShieldCheck size={14} />
          <span>COMPARTIR RUTA</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className={`w-full py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md shadow-emerald-200 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50 ${className}`}
        >
          <ShieldCheck size={16} />
          <span>Compartir mi ruta segura por WhatsApp</span>
        </button>
      )}

      {/* MODAL DETALLADO DE COMPARTIR RUTA SEGURA */}
      {showModal && shareData && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 text-left space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Ruta Segura Compartida</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Ruedas Rápidas</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200/80 p-3 rounded-2xl space-y-2">
              <p className="text-[11px] font-medium text-emerald-900 leading-snug">
                💬 <strong>Mensaje para WhatsApp preparado:</strong>
              </p>
              <div className="p-2.5 bg-white rounded-xl border border-emerald-100 text-[10px] text-slate-600 font-mono break-all select-all">
                {shareData.message}
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(shareData.message)}`, '_blank');
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-200 transition-all cursor-pointer"
              >
                <MessageSquare size={16} />
                <span>Reenviar por WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => copyToClipboard(shareData.officialLink)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                <span>{copied ? '¡Copiado!' : 'Copiar Enlace Oficial'}</span>
              </button>

              {onOpenTrackingView && (
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    onOpenTrackingView(viaje.id);
                  }}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <ExternalLink size={13} />
                  <span>Probar Vista de Contacto de Confianza</span>
                </button>
              )}
            </div>

            <p className="text-[9px] text-slate-400 text-center font-medium">
              🔒 El contacto deberá iniciar sesión para poder ver el mapa interactivo de OpenStreetMap.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
