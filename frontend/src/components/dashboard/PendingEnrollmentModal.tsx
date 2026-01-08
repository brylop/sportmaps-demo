import { useEffect, useState } from 'react';
import { getPendingEnrollment, clearPendingEnrollment, PendingEnrollment } from '@/lib/pending-enrollment';
import { PaymentModal } from '@/components/payment/PaymentModal';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export function PendingEnrollmentModal() {
  const [pendingEnrollment, setPendingEnrollment] = useState<PendingEnrollment | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for pending enrollment on mount
    const enrollment = getPendingEnrollment();
    if (enrollment) {
      setPendingEnrollment(enrollment);
      setShowPaymentModal(true);
    }
  }, []);

  const handlePaymentSuccess = () => {
    clearPendingEnrollment();
    setPendingEnrollment(null);
    setShowPaymentModal(false);
    
    toast({
      title: 'SportMaps: Tu inscripción se ha sincronizado con tu calendario',
      description: 'Revisa tu calendario para ver los detalles de tus clases',
    });
    
    // Navigate to calendar to see the new event
    setTimeout(() => {
      navigate('/calendar');
    }, 1500);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      // User closed the modal without paying - clear the pending enrollment
      clearPendingEnrollment();
      setPendingEnrollment(null);
    }
    setShowPaymentModal(open);
  };

  if (!pendingEnrollment) return null;

  return (
    <PaymentModal
      open={showPaymentModal}
      onOpenChange={handleClose}
      item={{
        type: 'enrollment',
        id: pendingEnrollment.programId,
        name: pendingEnrollment.programName,
        description: pendingEnrollment.schoolName,
        amount: pendingEnrollment.amount,
        schoolId: pendingEnrollment.schoolId,
        programId: pendingEnrollment.programId,
      }}
      onSuccess={handlePaymentSuccess}
    />
  );
}
