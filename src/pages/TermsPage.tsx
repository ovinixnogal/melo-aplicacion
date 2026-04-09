import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import './AuthLegal.css';

const TermsPage: React.FC = () => {
  return (
    <div className="legal-root">
      <div className="auth-grain" />
      
      <div className="legal-container animate-in fade-in slide-in-from-bottom-10 duration-700">
        <header className="legal-header">
          <Link to="/" className="back-link mb-8">
            <ArrowLeft size={16} /> Volver al Inicio
          </Link>
          <h1 className="legal-title">Términos y<br />Condiciones</h1>
          <p className="legal-meta">Última actualización: 28 de Marzo, 2026 · Caracas, VE</p>
        </header>

        <main className="legal-content">
          <section className="legal-section">
            <h2>1. Aceptación del Servicio</h2>
            <p>
              Al acceder y utilizar MELO, usted acepta estar sujeto a estos términos. 
              Nuestra plataforma proporciona herramientas de gestión para prestamistas independientes 
              en Venezuela, incluyendo cálculos basados en la tasa oficial del BCV.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Privacidad de los Datos</h2>
            <p>
              Sus datos son privados y están cifrados. MELO no comparte información de 
              sus clientes ni de sus préstamos con terceros. Usted es el único responsable de la 
              confidencialidad de sus credenciales de acceso.
            </p>
            <ul>
              <li>Cifrado de extremo a extremo en base de datos.</li>
              <li>Acceso restringido por autenticación Google.</li>
              <li>No almacenamos claves en texto plano.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. Modelo de Suscripción</h2>
            <p>
              MELO opera bajo un modelo SaaS de suscripción mensual. 
              El incumplimiento en el pago resultará en la restricción temporal del acceso 
              al panel de gestión de préstamos.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Responsabilidad Financiera</h2>
            <p>
              MELO es una herramienta de software de asistencia. No somos una 
              institución bancaria ni nos hacemos responsables por la recuperación de capital 
              de los préstamos registrados por el usuario. Los cálculos de la tasa BCV son 
              informativos y basados en fuentes públicas oficiales.
            </p>
          </section>

          <section className="legal-section">
             <div className="p-6 bg-pear/10 border-2 border-slate rounded-2xl flex gap-4">
                <ShieldCheck className="shrink-0 text-slate" size={24} />
                <p className="text-[11px] font-bold uppercase leading-relaxed text-slate/70">
                  ESTA PLATAFORMA ES UNA HERRAMIENTA DE ASISTENCIA PARA GESTIONAR PRESTAMOS. 
                  SU USO ESTÁ SUJETO A LAS LEYES VIGENTES DE LA REPÚBLICA BOLIVARIANA DE VENEZUELA.
                </p>
             </div>
          </section>
        </main>

        <footer className="legal-footer">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-slate text-pear flex items-center justify-center rounded-xl font-black italic shadow-[4px_4px_0_#E2FF3B]">
              M
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">MELO Platform</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default TermsPage;

