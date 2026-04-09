import React, { useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { auth } from '../api/firebase';
import { signOut } from 'firebase/auth';
import { useExchangeRate } from '../hooks/useExchangeRate';
import {
  MessageCircle,
  X,
  Copy,
  Check,
  ChevronRight,
  LogOut,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';


const WHATSAPP_NUMBER = '584124898715';
const SUBSCRIPTION_USD = 3;

// Payment data
const PAGO_MOVIL = {
  phone: '04124898715',
  cedula: '31395897',
  bank: 'Bancamiga',
};

// ── Copy Button ────────────────────────────────────────────────────────────────
function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handle}
      className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${copied ? 'text-[#E2FF3B]' : 'text-white/30 hover:text-white'}`}
    >
      {copied ? <Check size={12} strokeWidth={3} /> : <Copy size={12} strokeWidth={3} />}
      {label ?? (copied ? 'Copiado' : 'Copiar')}
    </button>
  );
}

// ── Payment Modal ──────────────────────────────────────────────────────────────
interface PaymentModalProps {
  userEmail: string;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

function PaymentModal({ userEmail, onClose }: PaymentModalProps) {
  const [step, setStep] = useState<Step>(1);
  const { exchangeRate, loading: rateLoading } = useExchangeRate();
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [allCopied, setAllCopied] = useState(false);

  const rate = exchangeRate?.rate || 0;
  const amountBs = rate ? (SUBSCRIPTION_USD * rate).toFixed(2) : '...';

  const allDataText = `Teléfono: ${PAGO_MOVIL.phone}
Cédula: ${PAGO_MOVIL.cedula}
Banco: ${PAGO_MOVIL.bank}
Monto: Bs. ${amountBs} (${SUBSCRIPTION_USD} USD)`;

  const handleCopyAll = () => {
    navigator.clipboard.writeText(allDataText).then(() => {
      setAllCopied(true);
      setTimeout(() => setAllCopied(false), 2000);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshot(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleSendWhatsApp = () => {
    const msg = encodeURIComponent(
      `Hola Soporte de Melo 👋, adjunto el pago de mi suscripción mensual.\n\n📧 Correo: ${userEmail}\n\n🧾 [Pago Adjunto]`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  };

  const stepMeta: Record<Step, { title: string; subtitle: string }> = {
    1: { title: 'Datos de Pago', subtitle: 'Copia los datos para el pago móvil' },
    2: { title: 'Comprobante', subtitle: 'Sube la captura de tu pago' },
    3: { title: 'Verificación', subtitle: 'Envía los detalles a soporte' },
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#1A1A1A]/95 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#1A1A1A] border border-white/5 rounded-[3rem] overflow-hidden shadow-3xl">
        {/* Top Accent */}
        <div className="h-2 w-full bg-gradient-to-r from-[#E2FF3B] to-emerald-400" />

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-white/5 text-white/40 hover:text-white rounded-xl transition-all"
        >
          <X size={20} />
        </button>

        <div className="p-8 sm:p-10">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-[#E2FF3B] text-[#1A1A1A] text-[9px] font-black rounded-full uppercase tracking-widest">
                Paso {step} de 3
              </span>
            </div>
            <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">{stepMeta[step].title}</h2>
            <p className="text-sm font-medium text-white/40">{stepMeta[step].subtitle}</p>
          </div>

          {/* Body Content */}
          <div className="space-y-6">
            {step === 1 && (
              <>
                <div className="space-y-4 p-6 bg-white/5 rounded-3xl border border-white/5">
                  <div className="flex justify-between items-center group">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1 italic">Teléfono</p>
                      <p className="text-lg font-black text-white">{PAGO_MOVIL.phone}</p>
                    </div>
                    <CopyButton text={PAGO_MOVIL.phone} />
                  </div>
                  <div className="h-px bg-white/5 w-full" />
                  <div className="flex justify-between items-center group">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1 italic">Cédula</p>
                      <p className="text-lg font-black text-white">{PAGO_MOVIL.cedula}</p>
                    </div>
                    <CopyButton text={PAGO_MOVIL.cedula} />
                  </div>
                  <div className="h-px bg-white/5 w-full" />
                  <div className="flex justify-between items-center group">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1 italic">Banco</p>
                      <p className="text-lg font-black text-white">{PAGO_MOVIL.bank}</p>
                    </div>
                  </div>
                  <div className="h-px bg-white/5 w-full" />
                  <div className="flex justify-between items-center group">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#E2FF3B] mb-1 italic">Monto en Bs (BCV)</p>
                      {rateLoading ? (
                        <div className="flex items-center gap-2 italic text-white/40">
                          <Loader2 size={14} className="animate-spin text-[#E2FF3B]" /> Calculando...
                        </div>
                      ) : (
                        <p className="text-2xl font-black text-white italic tracking-tighter">Bs. {amountBs}</p>
                      )}
                    </div>
                    {!rateLoading && <CopyButton text={amountBs} />}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleCopyAll}
                    className="w-full py-4 bg-white/5 text-white/60 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all flex items-center justify-center gap-2"
                  >
                    {allCopied ? <Check size={16} /> : <Copy size={16} />}
                    {allCopied ? '¡Todos los datos copiados!' : 'Copiar todo el bloque'}
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="w-full py-5 bg-[#E2FF3B] text-[#1A1A1A] rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-[#E2FF3B]/10 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    Ya realicé el pago <ChevronRight size={18} />
                  </button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-56 bg-white/5 border-2 border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-all overflow-hidden relative group"
                >
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  
                  {previewUrl ? (
                    <>
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover p-2 rounded-[2rem]" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-black text-white text-[10px] uppercase tracking-widest">
                        Cambiar Captura
                      </div>
                    </>
                  ) : (
                    <div className="text-center space-y-3">
                      <div className="w-16 h-16 bg-[#E2FF3B]/10 rounded-[1.5rem] flex items-center justify-center mx-auto">
                        <ImageIcon size={32} className="text-[#E2FF3B]" />
                      </div>
                      <p className="text-xs font-black text-white uppercase tracking-widest">Subir Comprobante</p>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">PNG, JPG o Captura</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setStep(3)}
                    disabled={!screenshot}
                    className="w-full py-5 bg-[#E2FF3B] text-[#1A1A1A] rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] shadow-lg disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    Siguiente paso <ChevronRight size={18} />
                  </button>
                  <button onClick={() => setStep(1)} className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white">Regresar</button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                      <ShieldCheck size={24} className="text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white uppercase tracking-tighter">¡Casi Listo!</p>
                      <p className="text-[10px] font-bold text-white/40 uppercase">Soporte activará tu acceso</p>
                    </div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/20 italic">Mensaje a Soporte:</p>
                    <p className="text-[11px] font-medium text-white/60 italic leading-relaxed">"Hola soporte de Melo, adjunto el pago de mi suscripción. Correo: {userEmail}"</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleSendWhatsApp}
                    className="w-full py-5 bg-[#25D366] text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <MessageCircle size={20} fill="white" /> Enviar por WhatsApp
                  </button>
                  <button onClick={() => setStep(2)} className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white">Cambiar imagen</button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-8 pb-8 text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/10">Validación instantánea · Soporte @melo</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
const SubscriptionPage: React.FC = () => {
  const { user } = useAuth();
  const { isActive } = useSubscription();
  const [modalOpen, setModalOpen] = useState(false);

  if (isActive) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleSupport = () => {
    const msg = encodeURIComponent(
      `Hola Soporte de Melo 👋, necesito activar mi suscripción. Correo: ${user?.email || ''}`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#E2FF3B]/5 rounded-full blur-[100px] animate-blob" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] animate-blob" style={{ animationDelay: '2s' }} />
      <div className="absolute inset-0 bg-grain opacity-5" />

      <div className="w-full max-w-[440px] relative z-10 flex flex-col items-center text-center">
        {/* Brand Icon */}
        <div className="mb-10 group relative">
          <div className="w-24 h-24 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] flex items-center justify-center shadow-2xl transition-all duration-500 hover:rotate-6">
            <CreditCard size={44} strokeWidth={1} className="text-[#E2FF3B]" />
          </div>
          <div className="absolute -bottom-3 -right-3 w-10 h-10 bg-rose-500 rounded-2xl flex items-center justify-center shadow-lg border-4 border-[#1A1A1A] transform group-hover:scale-110 transition-all">
            <AlertCircle size={18} className="text-white" strokeWidth={3} />
          </div>
        </div>

        {/* Content Header */}
        <div className="space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-300 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-rose-500/20">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
            Acceso Restringido
          </div>
          <h1 className="text-5xl font-black italic tracking-tighter leading-none text-white uppercase sm:text-6xl">
            Suscripción <br /> <span className="text-[#E2FF3B]">Vencida</span>.
          </h1>
          <p className="text-base text-white/40 font-medium leading-relaxed max-w-[320px] mx-auto italic">
            Tu suscripción ya expiró, si quieres seguir gestionando tus préstamos con Melo, contáctate para renovar o activar por primera vez.
          </p>
        </div>

        {/* Primary Actions */}
        <div className="w-full space-y-4">
          <button
            onClick={() => setModalOpen(true)}
            className="w-full py-5 bg-white text-[#1A1A1A] rounded-[1.75rem] text-[13px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-[#E2FF3B] transition-all transform hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-3 group"
          >
            Pagar Ahora <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button
            onClick={handleSupport}
            className="w-full py-5 bg-white/5 text-white rounded-[1.75rem] text-[11px] font-black uppercase tracking-[0.2em] border border-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-3 backdrop-blur-md"
          >
            <MessageCircle size={18} /> Contactar Soporte
          </button>
        </div>

        {/* Secondary Info */}
        <div className="mt-12 flex flex-col items-center gap-6">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] italic">Atención Directa: 0412-489-8715</p>
          
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-rose-400 transition-all px-6 py-3 rounded-full hover:bg-rose-400/5 group"
          >
            <div className="p-2 border border-white/10 rounded-xl group-hover:border-rose-400/30 transition-colors">
              <LogOut size={14} />
            </div>
            Cerrar Sesión Activa
          </button>
        </div>
      </div>

      {modalOpen && (
        <PaymentModal 
          userEmail={user?.email || ''} 
          onClose={() => setModalOpen(false)} 
        />
      )}
    </div>
  );
};

export default SubscriptionPage;
