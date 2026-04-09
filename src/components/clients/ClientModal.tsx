import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  User, 
  Phone, 
  Mail, 
  PlusCircle, 
  Save,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { Client } from '../../hooks/useClients';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';

const clientSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  phone: z.string().min(8, 'El teléfono debe tener al menos 8 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ClientFormValues) => Promise<void>;
  initialData?: Client | null;
  mode?: 'add' | 'edit';
}

const ClientModal: React.FC<ClientModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData,
  mode = 'add'
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
  });

  useEffect(() => {
    if (initialData && mode === 'edit') {
      setValue('name', initialData.name);
      setValue('phone', initialData.phone || '');
      setValue('email', initialData.email || '');
    } else {
      reset({ name: '', phone: '', email: '' });
    }
  }, [initialData, mode, setValue, reset]);

  const handleFormSubmit = async (data: ClientFormValues) => {
    if (!user) return;
    setLoading(true);
    try {
      await onSubmit(data);
      reset();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Error al guardar cliente. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar Cliente' : 'Agregar Cliente'}
      subtitle={mode === 'edit' ? 'Actualizar Ficha de Deudor' : 'Nueva Alta en el Sistema'}
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 pt-4">

        <Input
          label="Nombre Completo / Razón Social"
          placeholder="Ej. Juan Manuel Pérez"
          icon={<User size={18} />}
          error={errors.name?.message}
          {...register('name')}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Teléfono / WhatsApp"
            placeholder="+58 424..."
            type="tel"
            icon={<Phone size={18} />}
            error={errors.phone?.message}
            {...register('phone')}
          />

          <Input
            label="Email (Opcional)"
            placeholder="cliente@correo.com"
            type="email"
            icon={<Mail size={18} />}
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <div className="pt-6 flex flex-col gap-3">
          <Button
            type="submit"
            isLoading={loading}
            variant={mode === 'edit' ? 'primary' : 'secondary'}
            size="lg"
            rightIcon={loading ? <Loader2 size={20} className="animate-spin" /> : mode === 'edit' ? <Save size={20} className="text-pear" /> : <PlusCircle size={20} className="text-slate" />}
          >
            {mode === 'edit' ? 'Guardar Cambios' : 'Registrar Cliente'}
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ClientModal;
