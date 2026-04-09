export interface Installment {
  id: string;
  dueDate: Date;
  amount: number;        // monto original de la cuota
  paidAmount: number;    // total pagado hasta ahora (0 = nada)
  status: 'pending' | 'partial' | 'paid';
  paymentDate: Date | null;
  createdAt: Date;
}
