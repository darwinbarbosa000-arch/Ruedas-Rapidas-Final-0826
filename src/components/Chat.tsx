import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, MessageCircle, User, Truck } from 'lucide-react';
import { enviarMensaje, escucharMensajes, Mensaje } from '../services/chatService';

interface ChatProps {
  viajeId: string;
  senderId: string;
  senderName: string;
  recipientName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Chat: React.FC<ChatProps> = ({ viajeId, senderId, senderName, recipientName, isOpen, onClose }) => {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viajeId) {
      const unsubscribe = escucharMensajes(viajeId, (msgs) => {
        setMensajes(msgs);
      });
      return () => unsubscribe();
    }
  }, [viajeId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim()) return;

    try {
      await enviarMensaje(viajeId, senderId, senderName, nuevoMensaje.trim());
      setNuevoMensaje('');
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          className="fixed bottom-20 right-4 w-[calc(100%-2rem)] sm:w-96 h-[500px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden z-[100]"
        >
          {/* Header */}
          <div className="bg-slate-900 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white">
                <MessageCircle size={20} />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm leading-tight">{recipientName}</h4>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Chat en vivo</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50"
          >
            {mensajes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-40">
                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                  <MessageCircle size={24} />
                </div>
                <p className="text-xs font-medium text-slate-500">Inicia la conversación con {recipientName}</p>
              </div>
            ) : (
              mensajes.map((msg, index) => {
                const isMe = msg.senderId === senderId;
                return (
                  <motion.div
                    initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={msg.id || index}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] space-y-1`}>
                      <div className={`p-3 rounded-2xl text-sm ${
                        isMe 
                          ? 'bg-emerald-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none shadow-sm'
                      }`}>
                        {msg.text}
                      </div>
                      <p className={`text-[8px] font-bold uppercase tracking-tighter text-slate-400 ${isMe ? 'text-right' : 'text-left'}`}>
                        {msg.timestamp?.toDate ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                      </p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Input Area */}
          <form 
            onSubmit={handleSend}
            className="p-4 bg-white border-t border-slate-100 flex gap-2"
          >
            <input
              type="text"
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!nuevoMensaje.trim()}
              className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
            >
              <Send size={20} />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
