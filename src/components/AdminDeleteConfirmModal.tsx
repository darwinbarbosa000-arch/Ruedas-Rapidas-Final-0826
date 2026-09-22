import React from 'react';
import { Trash2, AlertTriangle, X, ShieldAlert, CheckCircle2, User, Car, Store, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface DeleteItemInfo {
  id: string;
  tipo: 'usuario' | 'conductor' | 'aliado';
  nombre: string;
  email?: string;
  telefono?: string;
  motivoSugerido?: string;
  detalles?: string;
}

interface AdminDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetItem: DeleteItemInfo | null;
  batchItems: DeleteItemInfo[];
  isDeleting: boolean;
  reasonSelection: string;
  setReasonSelection: (r: string) => void;
  reasonCustom: string;
  setReasonCustom: (r: string) => void;
  onConfirm: () => Promise<void>;
}

export const AdminDeleteConfirmModal: React.FC<AdminDeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  targetItem,
  batchItems,
  isDeleting,
  reasonSelection,
  setReasonSelection,
  reasonCustom,
  setReasonCustom,
  onConfirm
}) => {
  if (!isOpen) return null;

  const isBatch = batchItems && batchItems.length > 0;
  const count = isBatch ? batchItems.length : 1;
  const itemType = isBatch ? batchItems[0]?.tipo : targetItem?.tipo;

  const typeLabel = itemType === 'usuario' ? 'usuario(s)' : itemType === 'conductor' ? 'conductor(es)' : 'aliado(s)';

  const motivosPredefinidos = [
    'Inactividad prolongada (0 servicios / sin uso)',
    'Cuenta identificada como Spam / Publicidad no autorizada',
    'Registro de prueba o información falsa / incompleta',
    'Violación a términos del servicio o múltiples quejas',
    'Criterio discrecional del administrador',
    'Otro motivo personalizado'
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 sm:p-7 shadow-2xl border border-slate-100 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 shadow-inner">
              <Trash2 size={24} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-100/60 px-2 py-0.5 rounded-md inline-block mb-1">
                Acción Definitiva
              </span>
              <h3 className="text-lg font-black text-slate-900 leading-tight">
                {isBatch ? `¿Eliminar ${count} ${typeLabel}?` : `¿Eliminar ${itemType}: "${targetItem?.nombre}"?`}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900 space-y-1">
            <p className="font-bold">Esta acción borrará el registro de Firestore de forma permanente.</p>
            <p className="text-rose-700 text-[11px] leading-relaxed">
              El registro desaparecerá del panel de control y de las búsquedas. Esta operación solo puede ser ejecutada por administradores del sistema.
            </p>
          </div>
        </div>

        {/* Item or Batch Details Card */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-2">
          {!isBatch && targetItem ? (
            <div className="space-y-1.5 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Nombre / Razón:</span>
                <span className="font-medium text-slate-800">{targetItem.nombre}</span>
              </div>
              {targetItem.email && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">Email:</span>
                  <span className="text-slate-600">{targetItem.email}</span>
                </div>
              )}
              {targetItem.telefono && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">Teléfono:</span>
                  <span className="text-slate-600">{targetItem.telefono}</span>
                </div>
              )}
              {targetItem.detalles && (
                <div className="pt-1 text-[11px] text-slate-500 border-t border-slate-200/60 mt-2">
                  {targetItem.detalles}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Registros a eliminar ({batchItems.length}):</span>
                <span className="text-[10px] text-slate-500 font-semibold">Depuración en bloque</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {batchItems.map((item, idx) => (
                  <div key={`batch-${item.id}-${idx}`} className="flex items-center justify-between text-[11px] p-2 bg-white rounded-xl border border-slate-200/60">
                    <span className="font-bold text-slate-800 truncate max-w-[240px]">{item.nombre}</span>
                    <span className="text-[10px] text-slate-500 truncate">{item.telefono || item.email || item.tipo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Motivo de la eliminación */}
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
            Motivo de eliminación (auditoría interna):
          </label>
          <div className="space-y-1.5">
            {motivosPredefinidos.map((motivo) => (
              <label
                key={motivo}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                  reasonSelection === motivo
                    ? 'bg-rose-50/70 border-rose-300 text-rose-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="motivoEliminacion"
                  value={motivo}
                  checked={reasonSelection === motivo}
                  onChange={() => setReasonSelection(motivo)}
                  className="w-3.5 h-3.5 text-rose-600 focus:ring-rose-500 border-slate-300"
                />
                <span className="flex-1">{motivo}</span>
              </label>
            ))}
          </div>

          {reasonSelection === 'Otro motivo personalizado' && (
            <textarea
              rows={2}
              value={reasonCustom}
              onChange={(e) => setReasonCustom(e.target.value)}
              placeholder="Escribe el motivo detallado de la eliminación..."
              className="w-full mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder:text-slate-400"
            />
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                {isBatch ? `Eliminar (${count})` : 'Confirmar Eliminación'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
