import React, { useState } from 'react';
import { X, ArrowRight, Wallet, Users, Receipt, CheckCircle2, Sparkles } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../api/firebase';

interface OnboardingModalProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ userId, userName, onClose }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const handleComplete = async () => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        hasSeenTutorial: true
      });
      onClose();
    } catch (err) {
      console.error("Error updating tutorial state:", err);
      onClose(); // Close anyway
    }
  };

  const steps = [
    {
      title: "Paso 1: Define tu Capital",
      description: "Antes de prestar, necesitas registrar tus fondos. Ve a 'Capital' e ingresa tu capital de trabajo disponible tanto en USD como en Bs.",
      icon: Wallet,
      color: "bg-emerald-50 text-emerald-600",
      buttonText: "Entendido, ¿qué sigue?"
    },
    {
      title: "Paso 2: Gestiona tu Cartera",
      description: "Registra a las personas a las que les entregas créditos. Mantén sus perfiles organizados para un seguimiento profesional de cada deudor.",
      icon: Users,
      color: "bg-blue-50 text-blue-600",
      buttonText: "Bien, ¿el último paso?"
    },
    {
      title: "Paso 3: Registra tus Préstamos",
      description: "¡Es hora de crecer! Define cuotas, intereses y fechas de vencimiento. Melo calculará automáticamente cuánto deben pagarte y cuándo.",
      icon: Receipt,
      color: "bg-violet-50 text-violet-600",
      buttonText: "¡Empezar a Cobrar!"
    }
  ];

  const currentStep = steps[step - 1];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate/80 backdrop-blur-xl animate-in fade-in duration-500" onClick={handleComplete}></div>
      
      <div className="relative w-full max-w-xl max-h-[90vh] bg-white rounded-[32px] md:rounded-[40px] shadow-3xl overflow-y-auto border-2 border-slate animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 custom-scrollbar">
        {/* Progress Bar */}
        <div className="sticky top-0 left-0 right-0 h-2 flex z-10">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={`flex-1 transition-all duration-700 ${s <= step ? 'bg-pear' : 'bg-gray-100'}`} 
            />
          ))}
        </div>

        <div className="p-6 md:p-12">
          {/* Header */}
          <div className="flex justify-between items-start mb-10">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-pear/20 text-slate rounded-2xl flex items-center justify-center animate-pulse">
                  <Sparkles size={20} />
               </div>
               <div>
                  <h3 className="text-sm font-black text-slate/40 uppercase tracking-[0.2em] leading-none mb-1">Bienvenido, {userName.split(' ')[0]}</h3>
                  <h2 className="text-2xl font-black italic text-slate tracking-tight">Guía de Inicio Rápido</h2>
               </div>
            </div>
            <button 
              onClick={handleComplete}
              className="p-3 text-gray-300 hover:text-rose-500 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
             <div className={`w-28 h-28 ${currentStep.color} rounded-[32px] flex items-center justify-center shadow-lg transform rotate-3`}>
                <currentStep.icon size={56} strokeWidth={2.5} />
             </div>

             <div className="space-y-4 max-w-sm">
                <h4 className="text-2xl font-black text-slate tracking-tight italic leading-tight uppercase">
                   {currentStep.title}
                </h4>
                <p className="text-gray-500 text-sm font-bold leading-relaxed">
                   {currentStep.description}
                </p>
             </div>

             {/* Footer Button */}
             <div className="w-full pt-4">
                <button
                  onClick={() => step < totalSteps ? setStep(step + 1) : handleComplete()}
                  className="w-full brutalist-btn !py-6 group"
                >
                  <span className="flex items-center justify-center gap-3">
                    {currentStep.buttonText}
                    {step < totalSteps ? <ArrowRight size={20} /> : <CheckCircle2 size={20} />}
                  </span>
                </button>
                
                <div className="flex justify-center gap-2 mt-8">
                   {[1, 2, 3].map((n) => (
                     <button
                        key={n}
                        onClick={() => setStep(n)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${n === step ? 'w-8 bg-slate' : 'w-2 bg-gray-200 hover:bg-gray-300'}`}
                     />
                   ))}
                </div>
             </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-[-20%] left-[-10%] w-64 h-64 bg-pear/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="absolute top-[10%] right-[-10%] w-48 h-48 bg-emerald-50 rounded-full blur-3xl pointer-events-none -z-10"></div>
      </div>
    </div>
  );
};

export default OnboardingModal;
