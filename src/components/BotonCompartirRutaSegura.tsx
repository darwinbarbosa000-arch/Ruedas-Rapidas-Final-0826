import React, { useState } from 'react';
import { ShieldCheck, Share2, Copy, ExternalLink, Check, MessageSquare, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { compartirViajeSeguro } from '../services/viajeCompartidoService';

interface BotonCompartirRutaSeguraProps {
  viaje: any;
  user: any;
  perfil?: any;
  className?: string;
  variant?: 'banner' | 'button' | 'compact' | 'inline-action';
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
      {/* 1. Variante Banner Discreto (para estado 'en_transito') */}
      {variant === 'banner' ? (
        <div className="w-full bg-emerald-50/95 border border-emerald-200/90 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck size={12} />
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase text-emerald-900 tracking-wider">
                  Ruta Segura WhatsApp
                </span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <p className="text-[10px] font-medium text-slate-500 truncate leading-none mt-0.5">
                Enlace en vivo con placa y ubicación
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1 shrink-0 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Share2 size={10} />
            <span>{sharing ? '...' : 'Enviar'}</span>
          </button>
        </div>
      ) : variant === 'inline-action' ? (
        /* 2. Variante Acción Integrada: elegante, minimalista y ajustada */
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          title="Compartir mi ruta segura por WhatsApp"
          className={`w-full py-1.5 px-2 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-[0.98] cursor-pointer ${className}`}
        >
          <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
          <span className="truncate">Compartir ruta segura por WhatsApp</span>
        </button>
      ) : (
        /* 3. Botón por defecto: Ultra-compacto, minimalista, refinado y 100% contenido en la pantalla */
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          title="Compartir mi ruta segura por WhatsApp"
          className={`w-full py-1.5 px-2 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-900 border border-emerald-200/80 rounded-xl text-[10px] font-semibold flex items-center justify-between gap-1.5 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 shadow-2xs ${className}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck size={11} />
            </div>
            <span className="text-[10px] font-bold text-slate-800 truncate">Ruta Segura</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-white/95 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
            <span className="tracking-wide">WhatsApp</span>
            <Share2 size={9} />
          </div>
        </button>
      )}

      {/* MODAL COMPACTO Y ELEGANTE */}
      {showModal && shareData && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-2xl p-4 max-w-sm w-full shadow-xl border border-slate-100 text-left space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 leading-tight">Ruta Segura Compartida</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Ruedas Rápidas</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-xs font-bold transition-all"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200/70 p-2.5 rounded-xl space-y-1.5">
              <p className="text-[10px] font-bold text-emerald-900">
                Mensaje de WhatsApp:
              </p>
              <div className="p-2 bg-white rounded-lg border border-emerald-100 text-[9px] text-slate-600 font-mono break-all line-clamp-3 select-all">
                {shareData.message}
              </div>
            </div>

            <div className="space-y-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(shareData.message)}`, '_blank');
                }}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <MessageSquare size={13} />
                <span>Reenviar por WhatsApp</span>
              </button>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => copyToClipboard(shareData.officialLink)}
                  className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copied ? 'Copiado' : 'Copiar link'}</span>
                </button>

                {onOpenTrackingView && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      onOpenTrackingView(viaje.id);
                    }}
                    className="py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer truncate"
                  >
                    <ExternalLink size={12} />
                    <span className="truncate">Ver ruta en vivo</span>
                  </button>
                )}
              </div>
            </div>

            <p className="text-[8px] text-slate-400 text-center font-medium pt-0.5">
              🔒 Monitoreo en vivo sobre OpenStreetMap con conductor y placa oficial.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
