import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update status banner in showUserMarcaRegistroModal
old_banner_pattern = r'\{\/\* Body Form \*\}\s*<form onSubmit=\{registrarMarcaDesdeUsuario\}[^>]*>\s*<div className="p-3 bg-gradient-to-r from-rose-500/5 to-pink-500/5[^"]*"[^>]*>.*?<\/div>'

new_banner = '''{/* Body Form */}
                      <form onSubmit={registrarMarcaDesdeUsuario} className="p-6 space-y-5 overflow-y-auto max-h-[70vh] custom-scrollbar text-left">
                        {(() => {
                          const miMarca = marcasAliadas.find(m => m.creadorId === user?.uid);
                          if (!miMarca) {
                            return (
                              <div className="p-3.5 bg-gradient-to-r from-rose-500/5 to-pink-500/5 rounded-2xl border border-rose-500/10 text-[10.5px] text-rose-800 leading-relaxed font-bold flex items-start gap-2.5">
                                <span className="text-base">🛡️</span>
                                <div>
                                  <p className="font-black uppercase text-[10px] text-rose-700">Protocolo de Registro Seguro</p>
                                  <p className="text-slate-600 font-medium text-[9.5px] mt-0.5">
                                    Al registrar tu comercio, entrará en un proceso de validación anti-spam por parte de la administración para verificar los datos comerciales antes de su publicación general.
                                  </p>
                                </div>
                              </div>
                            );
                          }

                          if (isMarcaPendiente(miMarca)) {
                            return (
                              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 leading-relaxed flex items-start gap-2.5">
                                <Clock size={18} className="text-amber-600 animate-spin shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-black uppercase text-[10px] text-amber-800 tracking-wider">
                                    En Espera de Aprobación Anti-Spam
                                  </p>
                                  <p className="text-slate-600 font-medium text-[9.5px] mt-0.5">
                                    Tu comercio está registrado y en cola de validación por la administración. Una vez aprobado, estará disponible para todos los usuarios y conductores de tu ciudad.
                                  </p>
                                </div>
                              </div>
                            );
                          }

                          if (isMarcaRechazada(miMarca)) {
                            return (
                              <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-rose-900 leading-relaxed flex items-start gap-2.5">
                                <Ban size={18} className="text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-black uppercase text-[10px] text-rose-800 tracking-wider">
                                    Registro Requiere Corrección
                                  </p>
                                  <p className="text-rose-700 font-bold text-[9.5px] mt-0.5">
                                    {miMarca.motivoRechazo ? `Motivo: ${miMarca.motivoRechazo}.` : 'Por favor corrige los datos comerciales o WhatsApp.'} Actualiza los campos a continuación y guarda para reenviar a revisión.
                                  </p>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 leading-relaxed flex items-start gap-2.5">
                              <CheckCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-black uppercase text-[10px] text-emerald-800 tracking-wider">
                                  Comercio Verificado y Activo
                                </p>
                                <p className="text-slate-600 font-medium text-[9.5px] mt-0.5">
                                  Tu marca está visible para todos los clientes en {miMarca.ciudad}. Mantén activa tu Oferta del Día para figurar en la vitrina destacada superior.
                                </p>
                              </div>
                            </div>
                          );
                        })()}'''

content, num_subs = re.subn(old_banner_pattern, new_banner, content, count=1, flags=re.DOTALL)
print(f"Banner replaced: {num_subs}")

# 2. Add marcaToRejectModal and marcaToInspectModal before line '{showAdminMessageModal && adminMessageTarget && ('
reject_inspect_modals = '''
            {/* Modal de Rechazo de Marca Aliada (Anti-Spam) */}
            <AnimatePresence>
              {marcaToRejectModal.isOpen && marcaToRejectModal.marca && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-slate-100 shadow-2xl space-y-4 text-left relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                          <Ban size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                            Rechazar Marca Aliada
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {marcaToRejectModal.marca.nombre} • {marcaToRejectModal.marca.ciudad}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setMarcaToRejectModal({ isOpen: false, marca: null, motivo: '', customMotivo: '' })}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-100 space-y-1 text-[11px] text-rose-900">
                      <p className="font-bold">
                        El registro quedará marcado como rechazado y no se mostrará a los clientes.
                      </p>
                      <p className="text-[10px] text-rose-700 font-medium">
                        El comercio podrá ver el motivo especificado para corregir sus datos y volver a postularse.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-slate-500 ml-1 block">
                        Selecciona el Motivo de Rechazo
                      </label>
                      <div className="space-y-1.5">
                        {[
                          'Teléfono de WhatsApp no válido o no responde',
                          'Contenido no comercial / Sospecha de Spam',
                          'Dirección física o cobertura no verificable',
                          'Datos comerciales incompletos o erróneos',
                          'Otro motivo'
                        ].map((mOption) => (
                          <label
                            key={mOption}
                            onClick={() => setMarcaToRejectModal(prev => ({ ...prev, motivo: mOption }))}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                              marcaToRejectModal.motivo === mOption
                                ? 'bg-rose-50/80 border-rose-300 text-rose-900 shadow-xs'
                                : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100/70'
                            }`}
                          >
                            <input
                              type="radio"
                              name="motivoRechazoRadio"
                              checked={marcaToRejectModal.motivo === mOption}
                              onChange={() => {}}
                              className="text-rose-600 focus:ring-rose-500"
                            />
                            <span>{mOption}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {marcaToRejectModal.motivo === 'Otro motivo' && (
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-slate-500 ml-1 block">
                          Especificar Motivo Personalizado
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Explica brevemente la razón del rechazo para que el usuario pueda corregirlo..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500"
                          value={marcaToRejectModal.customMotivo}
                          onChange={e => setMarcaToRejectModal(prev => ({ ...prev, customMotivo: e.target.value }))}
                        />
                      </div>
                    )}

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setMarcaToRejectModal({ isOpen: false, marca: null, motivo: '', customMotivo: '' })}
                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={
                          isProcessingMarcaAction === marcaToRejectModal.marca.id ||
                          (marcaToRejectModal.motivo === 'Otro motivo' && !marcaToRejectModal.customMotivo.trim())
                        }
                        onClick={() => {
                          const reason = marcaToRejectModal.motivo === 'Otro motivo' ? marcaToRejectModal.customMotivo : marcaToRejectModal.motivo;
                          rechazarMarcaAliada(marcaToRejectModal.marca.id, reason, marcaToRejectModal.marca.nombre);
                          setMarcaToRejectModal({ isOpen: false, marca: null, motivo: '', customMotivo: '' });
                          if (marcaToInspectModal && marcaToInspectModal.id === marcaToRejectModal.marca.id) {
                            setMarcaToInspectModal(null);
                          }
                        }}
                        className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Ban size={14} />
                        Confirmar Rechazo
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Modal de Inspección Detallada de Marca Aliada */}
            <AnimatePresence>
              {marcaToInspectModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[105] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-slate-100 shadow-2xl space-y-5 text-left relative overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200/60 overflow-hidden shrink-0 flex items-center justify-center">
                          {marcaToInspectModal.logo ? (
                            <img src={marcaToInspectModal.logo} alt={marcaToInspectModal.nombre} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Store size={22} className="text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-base font-black text-slate-800 uppercase tracking-tight truncate">
                            {marcaToInspectModal.nombre}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              {marcaToInspectModal.categoria || 'Comercio'}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400">
                              {marcaToInspectModal.ciudad}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setMarcaToInspectModal(null)}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {/* Status Badge Banner */}
                    <div className="flex items-center justify-between p-3 rounded-2xl border bg-slate-50 border-slate-100 text-xs">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                        Estado de Moderación
                      </span>
                      {isMarcaPendiente(marcaToInspectModal) && (
                        <span className="flex items-center gap-1 text-[9px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                          <Clock size={11} /> En Espera Anti-Spam
                        </span>
                      )}
                      {isMarcaAprobada(marcaToInspectModal) && (
                        <span className="flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                          <CheckCheck size={11} /> Aprobado y Visible
                        </span>
                      )}
                      {isMarcaRechazada(marcaToInspectModal) && (
                        <span className="flex items-center gap-1 text-[9px] font-black text-rose-700 bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                          <Ban size={11} /> Rechazado
                        </span>
                      )}
                    </div>

                    {/* Commercial Data Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100/80 space-y-1">
                        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block">Dirección Comercial</span>
                        <p className="font-bold text-slate-700 flex items-center gap-1.5">
                          <MapPin size={13} className="text-rose-500 shrink-0" />
                          <span className="truncate">{marcaToInspectModal.direccion}</span>
                        </p>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100/80 space-y-1">
                        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block">Contacto WhatsApp</span>
                        <a
                          href={`https://wa.me/57${(marcaToInspectModal.whatsapp || '').replace(/\\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-emerald-700 flex items-center gap-1.5 hover:underline"
                        >
                          <Zap size={13} className="text-emerald-500 shrink-0" />
                          <span>{marcaToInspectModal.whatsapp}</span>
                        </a>
                      </div>
                    </div>

                    {/* Creator Identity */}
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100/80 space-y-2 text-xs">
                      <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block">Datos de Auditoría y Creador</span>
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="font-bold">{marcaToInspectModal.creadorNombre || marcaToInspectModal.creadorEmail || 'Administrador'}</span>
                        <span className="text-[9.5px] text-slate-400 font-mono">
                          {marcaToInspectModal.fechaCreacion ? new Date(marcaToInspectModal.fechaCreacion).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      {marcaToInspectModal.motivoRechazo && (
                        <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl text-rose-800 text-[10px] font-bold">
                          <span className="font-black uppercase">Motivo de Rechazo:</span> {marcaToInspectModal.motivoRechazo}
                        </div>
                      )}
                    </div>

                    {/* Offer Preview (If Active) */}
                    {marcaToInspectModal.oferta?.activa && (
                      <div className="p-3.5 bg-gradient-to-r from-rose-50 to-pink-50 rounded-2xl border border-rose-100 space-y-1.5 text-xs text-left">
                        <span className="text-[8.5px] font-black text-rose-600 uppercase tracking-wider flex items-center gap-1">
                          <span>⚡</span> Oferta del Día Configurada
                        </span>
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-slate-800">{marcaToInspectModal.oferta.titulo}</h5>
                          <span className="font-mono font-black text-rose-600">${Number(marcaToInspectModal.oferta.precioDescuento).toLocaleString()}</span>
                        </div>
                        {marcaToInspectModal.oferta.descripcion && (
                          <p className="text-[10px] text-slate-500">{marcaToInspectModal.oferta.descripcion}</p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                      {isMarcaPendiente(marcaToInspectModal) && (
                        <>
                          <button
                            onClick={() => {
                              aprobarMarcaAliada(marcaToInspectModal.id, marcaToInspectModal.nombre);
                              setMarcaToInspectModal(null);
                            }}
                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                          >
                            <Check size={15} />
                            Aprobar Comercio
                          </button>
                          <button
                            onClick={() => {
                              setMarcaToRejectModal({
                                isOpen: true,
                                marca: marcaToInspectModal,
                                motivo: 'Teléfono de WhatsApp no válido o no responde',
                                customMotivo: ''
                              });
                            }}
                            className="py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black rounded-xl text-xs uppercase tracking-wider transition-all border border-rose-200 cursor-pointer"
                          >
                            <Ban size={15} />
                            Rechazar
                          </button>
                        </>
                      )}

                      {isMarcaAprobada(marcaToInspectModal) && (
                        <button
                          onClick={() => {
                            reabrirRevisionMarca(marcaToInspectModal.id, marcaToInspectModal.nombre);
                            setMarcaToInspectModal(null);
                          }}
                          className="flex-1 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 font-black rounded-xl text-xs uppercase tracking-wider transition-all border border-amber-200 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Clock size={15} />
                          Pausar / Volver a Espera
                        </button>
                      )}

                      {isMarcaRechazada(marcaToInspectModal) && (
                        <button
                          onClick={() => {
                            aprobarMarcaAliada(marcaToInspectModal.id, marcaToInspectModal.nombre);
                            setMarcaToInspectModal(null);
                          }}
                          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                        >
                          <Check size={15} />
                          Aprobar Ahora
                        </button>
                      )}

                      <button
                        onClick={() => setMarcaToInspectModal(null)}
                        className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Cerrar
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
'''

target_anchor = '{showAdminMessageModal && adminMessageTarget && ('
if target_anchor in content:
    content = content.replace(target_anchor, reject_inspect_modals + '\n            ' + target_anchor, 1)
    print('Modals added successfully')
else:
    print('Target anchor NOT found')

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
