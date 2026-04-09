import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../api/firebase';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import Input from '../components/ui/Input';
import './AuthLegal.css';

const registerSchema = z.object({
  fullName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const RegisterPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: data.fullName,
      });

      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: data.fullName,
        displayName: data.fullName,
        email: data.email,
        isAdmin: false,
        banned: false,
        subscription: {
           status: 'trial',
           currentPeriodStart: now,
           currentPeriodEnd: trialEnd,
           plan: 'monthly',
           price: 3
        },
        subscriptionHistory: [{
           date: now,
           status: 'trial_started',
           note: 'Registro inicial de 7 días de prueba'
        }],
        createdAt: serverTimestamp(),
      });

      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado.');
      } else {
        setError('Hubo un error al crear la cuenta. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-grain" />

      {/* Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[10%] left-[-10%] w-[600px] h-[600px] bg-emerald-100/40 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[10%] right-[-15%] w-[450px] h-[450px] bg-pear/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="auth-card max-w-xl !p-10 md:!p-16 animate-in fade-in zoom-in duration-500">
        <Link to="/" className="back-link mb-8 inline-flex items-center gap-2">
           <ArrowRight className="rotate-180" size={14} /> Volver
        </Link>

        <div className="auth-logo-wrap">
          <div className="auth-logo-icon">
             <span className="text-3xl font-black italic">M</span>
          </div>
          <h1 className="auth-title underline decoration-pear decoration-8 underline-offset-4">
             Registro
          </h1>
          <p className="auth-subtitle">Únete a MELO</p>
        </div>

        {error && (
          <div className="mb-10 p-5 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-2xl border-2 border-slate flex items-center gap-3 animate-shake shadow-[4px_4px_0_#1A1A1A]">
              <AlertCircle size={18} />
              {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
          <Input
            label="Nombre Completo"
            placeholder="Juan Carlos Pérez"
            icon={<User size={18} />}
            error={errors.fullName?.message}
            {...register('fullName')}
          />

          <Input
            label="Correo Electrónico"
            placeholder="nombre@melo.com"
            type="email"
            icon={<Mail size={18} />}
            error={errors.email?.message}
            {...register('email')}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <Input
                label="Clave"
                placeholder="••••••••"
                type={showPassword ? 'text' : 'password'}
                icon={<Lock size={18} />}
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-6 top-[54px] text-gray-400 hover:text-slate transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <Input
              label="Verificar Clave"
              placeholder="••••••••"
              type={showPassword ? 'text' : 'password'}
              icon={<Lock size={18} />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="brutalist-btn mt-6"
          >
            {loading ? 'Creando Cuenta...' : (
              <>
                Confirmar Registro
                <ArrowRight size={20} strokeWidth={3} />
              </>
            )}
          </button>
        </form>

        <div className="flex flex-col items-center gap-4 mt-12">
          <p className="auth-footer-text !mt-0">
            ¿Ya tienes acceso?{' '}
            <Link to="/login" className="auth-footer-link">
              Entra aquí
            </Link>
          </p>
          <Link to="/terminos" className="text-[10px] font-black uppercase tracking-widest text-slate/40 hover:text-slate transition-colors">
            Términos y Condiciones
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;


