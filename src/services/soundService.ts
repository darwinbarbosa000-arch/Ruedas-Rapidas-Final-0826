/**
 * Ruedas Rápidas - Sistema de Audio Branding & Notificaciones Sonoras
 * Diseñado por IxD y Experto en Audio Branding para aplicaciones de alta frecuencia.
 * 
 * Utiliza la Web Audio API nativa para sintetizar tonos armónicos, limpios,
 * elegantes y altamente legibles en entornos ruidosos, evitando ruidos sintéticos estridentes.
 */

export interface SoundConfig {
  enabled: boolean;
  volume: number;
  nuevoViaje: boolean;
  viajeCancelado: boolean;
  viajeFinalizado: boolean;
  nuevoMensaje: boolean;
  seguridadAlerta: boolean;
}

const DEFAULT_CONFIG: SoundConfig = {
  enabled: true,
  volume: 0.8,
  nuevoViaje: true,
  viajeCancelado: true,
  viajeFinalizado: true,
  nuevoMensaje: true,
  seguridadAlerta: true,
};

class SoundService {
  private audioCtx: AudioContext | null = null;
  private config: SoundConfig = { ...DEFAULT_CONFIG };

  constructor() {
    this.loadConfig();
    // Añadimos listeners para inicializar el AudioContext en la primera interacción del usuario
    if (typeof window !== 'undefined') {
      const initAudioOnInteraction = () => {
        this.initAudioContext();
        window.removeEventListener('click', initAudioOnInteraction);
        window.removeEventListener('touchstart', initAudioOnInteraction);
      };
      window.addEventListener('click', initAudioOnInteraction);
      window.addEventListener('touchstart', initAudioOnInteraction);
    }
  }

  private loadConfig() {
    try {
      const saved = localStorage.getItem('ruedas_rapidas_sounds_config');
      if (saved) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("No se pudo cargar la configuración de audio", e);
    }
  }

  public saveConfig(newConfig: Partial<SoundConfig>) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem('ruedas_rapidas_sounds_config', JSON.stringify(this.config));
    } catch (e) {
      console.warn("No se pudo guardar la configuración de audio", e);
    }
  }

  public getConfig(): SoundConfig {
    return { ...this.config };
  }

  private initAudioContext(): boolean {
    if (this.audioCtx) return true;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
        return true;
      }
    } catch (e) {
      console.error("Web Audio API no soportada en este entorno", e);
    }
    return false;
  }

  /**
   * Crea un nodo de ganancia maestra respetando el volumen configurado.
   */
  private createMasterGain(duration: number): { masterGain: GainNode, ctx: AudioContext } | null {
    if (!this.config.enabled) return null;
    if (!this.initAudioContext()) return null;
    
    const ctx = this.audioCtx!;
    // Si el contexto está suspendido, intentar reanudarlo
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const masterGain = ctx.createGain();
    // Aplicar volumen maestro
    masterGain.gain.setValueAtTime(this.config.volume, ctx.currentTime);
    masterGain.connect(ctx.destination);

    return { masterGain, ctx };
  }

  /**
   * 1. Solicitud de Servicio (Nuevo viaje)
   * Timbre: Serie de 3 tonos limpios y rítmicamente ascendentes en arpegio brillante.
   * Modos de ataque suaves pero fáciles de percibir en ambientes con ruido urbano.
   */
  public playNuevoViaje() {
    if (!this.config.nuevoViaje) return;
    const resources = this.createMasterGain(0.8);
    if (!resources) return;
    const { masterGain, ctx } = resources;

    const notes = [
      { freq: 440.00, time: 0.0, dur: 0.12 }, // A4
      { freq: 554.37, time: 0.12, dur: 0.12 }, // C#5
      { freq: 659.25, time: 0.24, dur: 0.35 }, // E5
    ];

    notes.forEach((note) => {
      const startTime = ctx.currentTime + note.time;
      const stopTime = startTime + note.dur;

      // Oscilador principal (Onda Triángulo para calidez y solidez acústica)
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, startTime);

      // Oscilador secundario (Onda Senoidal para cuerpo y profundidad en bajos-medios)
      const oscSub = ctx.createOscillator();
      oscSub.type = 'sine';
      oscSub.frequency.setValueAtTime(note.freq / 2, startTime);

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0, startTime);
      // Soft attack
      noteGain.gain.linearRampToValueAtTime(0.35, startTime + 0.015);
      // Decay gradual
      noteGain.gain.exponentialRampToValueAtTime(0.001, stopTime);

      osc.connect(noteGain);
      oscSub.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(startTime);
      oscSub.start(startTime);
      osc.stop(stopTime);
      oscSub.stop(stopTime);
    });
  }

  /**
   * 2. Cancelación de Viaje
   * Timbre: Sonido descendente, suave y relajante, que marca el fin de la operación
   * sin generar sentimientos de frustración o molestia al usuario/conductor.
   */
  public playViajeCancelado() {
    if (!this.config.viajeCancelado) return;
    const resources = this.createMasterGain(1.0);
    if (!resources) return;
    const { masterGain, ctx } = resources;

    const startTime = ctx.currentTime;
    const duration = 0.6;

    // Oscilador cálido (senoidal)
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    
    // Filtro pasa bajos para redondear el tono y darle sobriedad
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, startTime);
    filter.frequency.exponentialRampToValueAtTime(150, startTime + duration);

    // Desplazamiento descendente de frecuencia de 392Hz (G4) a 261.63Hz (C4)
    osc.frequency.setValueAtTime(392.00, startTime);
    osc.frequency.exponentialRampToValueAtTime(220.00, startTime + duration);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  /**
   * 3. Viaje Finalizado
   * Timbre: Chime (campana) alegre, elegante y armónicamente perfecto.
   * Genera sensación de éxito, conclusión positiva y satisfacción comercial instantánea.
   */
  public playViajeFinalizado() {
    if (!this.config.viajeFinalizado) return;
    const resources = this.createMasterGain(1.2);
    if (!resources) return;
    const { masterGain, ctx } = resources;

    const chord = [
      { freq: 523.25, delay: 0.0 },  // C5
      { freq: 659.25, delay: 0.05 }, // E5
      { freq: 783.99, delay: 0.1 },  // G5
      { freq: 1046.50, delay: 0.15 } // C6
    ];

    chord.forEach((note) => {
      const startTime = ctx.currentTime + note.delay;
      const duration = 0.8;

      // Base armónica muy pura
      const oscSine = ctx.createOscillator();
      oscSine.type = 'sine';
      oscSine.frequency.setValueAtTime(note.freq, startTime);

      // Brillo metálico elegante (Onda triángulo a doble frecuencia)
      const oscTri = ctx.createOscillator();
      oscTri.type = 'triangle';
      oscTri.frequency.setValueAtTime(note.freq * 2, startTime);

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0, startTime);
      // Ataque de campana (rapidísimo)
      noteGain.gain.linearRampToValueAtTime(0.25, startTime + 0.01);
      noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      oscSine.connect(noteGain);
      oscTri.connect(noteGain);
      noteGain.connect(masterGain);

      oscSine.start(startTime);
      oscTri.start(startTime);
      oscSine.stop(startTime + duration);
      oscTri.stop(startTime + duration);
    });
  }

  /**
   * 4. Notificación General / Mensaje
   * Timbre: Sonido corto, neutro, sumamente sutil. Inspira profesionalismo.
   * Ideal para cuando llega un chat o un aviso sin urgencia.
   */
  public playNuevoMensaje() {
    if (!this.config.nuevoMensaje) return;
    const resources = this.createMasterGain(0.8);
    if (!resources) return;
    const { masterGain, ctx } = resources;

    const startTime = ctx.currentTime;
    const duration = 0.25;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    
    // Tono sutilmente alto pero suave: 880Hz (A5) que desliza rápido a 987.77Hz (B5)
    osc.frequency.setValueAtTime(880.00, startTime);
    osc.frequency.exponentialRampToValueAtTime(987.77, startTime + 0.06);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.35, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  /**
   * 5. Alerta de Seguridad / Emergencia
   * Timbre: Dos impulsos gemelos de media frecuencia detuneados para generar
   * una sensación de "latido" u oscilación sónica de guardia, llamativa e importante.
   */
  public playAlertaSeguridad() {
    if (!this.config.seguridadAlerta) return;
    const resources = this.createMasterGain(1.1);
    if (!resources) return;
    const { masterGain, ctx } = resources;

    const startTime = ctx.currentTime;
    
    const beats = [0.0, 0.35];
    const beatDur = 0.25;

    beats.forEach((delay) => {
      const beatStart = startTime + delay;
      const beatStop = beatStart + beatDur;

      // Dos frecuencias oscilando muy de cerca para crear distorsión acústica ("beating") de urgencia
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(293.66, beatStart); // D4

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(297.66, beatStart); // Sutilmente detuneado 4Hz arriba

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0, beatStart);
      noteGain.gain.linearRampToValueAtTime(0.4, beatStart + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.001, beatStop);

      osc1.connect(noteGain);
      osc2.connect(noteGain);
      noteGain.connect(masterGain);

      osc1.start(beatStart);
      osc2.start(beatStart);
      osc1.stop(beatStop);
      osc2.stop(beatStop);
    });
  }

  /**
   * Método de prueba general para reproducir por id sonora.
   */
  public playTestSound(soundId: string) {
    // Forzamos iniciación del contexto de audio
    this.initAudioContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    switch (soundId) {
      case 'nuevoViaje':
        this.playNuevoViaje();
        break;
      case 'viajeCancelado':
        this.playViajeCancelado();
        break;
      case 'viajeFinalizado':
        this.playViajeFinalizado();
        break;
      case 'nuevoMensaje':
        this.playNuevoMensaje();
        break;
      case 'seguridadAlerta':
        this.playAlertaSeguridad();
        break;
    }
  }
}

export const soundService = new SoundService();
