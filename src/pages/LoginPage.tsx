import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../api/firebase';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import Input from '../components/ui/Input';
import './AuthLegal.css';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError('Credenciales incorrectas o problema de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-grain" />
      
      {/* Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-pear/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] bg-indigo-100/30 rounded-full blur-[100px]"></div>
      </div>

      <div className="auth-card animate-in fade-in zoom-in duration-500">
        <Link to="/" className="back-link mb-8 inline-flex items-center gap-2">
           <ArrowRight className="rotate-180" size={14} /> Volver
        </Link>
        
        <div className="auth-logo-wrap">
          <div className="auth-logo-icon">
             <span className="text-2xl font-black italic">M</span>
          </div>
          <h1 className="auth-title underline decoration-pear decoration-8 underline-offset-4">
             Bienvenido
          </h1>
          <p className="auth-subtitle">MELO Access</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-xl border-2 border-slate flex items-center gap-3 animate-shake shadow-[4px_4px_0_#1A1A1A]">
            <div className="w-6 h-6 bg-rose-600 text-white rounded-lg flex items-center justify-center shrink-0">!</div>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
          <Input
            label="Email del Prestamista"
            placeholder="nombre@melo.com"
            type="email"
            icon={<Mail size={18} />}
            error={errors.email?.message}
            {...register('email')}
          />

          <div className="relative">
            <Input
              label="Clave de Seguridad"
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

          <button
            type="submit"
            disabled={loading}
            className="brutalist-btn mt-4"
          >
            {loading ? 'Validando...' : (
              <>
                Acceder al Portal
                <ArrowRight size={20} strokeWidth={3} />
              </>
            )}
          </button>
        </form>

        <div className="flex flex-col items-center gap-4 mt-12">
          <p className="auth-footer-text !mt-0">
            ¿No tienes acceso?{' '}
            <Link to="/register" className="auth-footer-link">
              Crea tu perfil aquí
            </Link>
          </p>
          <Link to="/terminos" className="text-[10px] font-black uppercase tracking-widest text-slate/40 hover:text-slate transition-colors">
            Términos y Condiciones
          </Link>
        </div>
      </div>

      {/* Decorative Label */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-20 pointer-events-none hidden md:block">
        <span className="text-[10px] font-black tracking-[0.5em] uppercase text-slate border-t border-slate/20 pt-4">
          Auth Platform v2.0
        </span>
      </div>
    </div>
  );
};

export default LoginPage;


