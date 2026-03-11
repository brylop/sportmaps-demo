import { useEffect, useState } from 'react';
import { getPendingEnrollment, clearPendingEnrollment, PendingEnrollment } from '@/lib/pending-enrollment';
import { PaymentModal } from '@/components/payment/PaymentModal';
import { ChildSelectorModal } from '@/components/enrollment/ChildSelectorModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export function PendingEnrollmentModal() {
  const [pendingEnrollment, setPendingEnrollment] = useState<PendingEnrollment | null>(null);
  const [showChildSelector, setShowChildSelector] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedChildName, setSelectedChildName] = useState<string>('');
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for pending enrollment on mount
    const enrollment = getPendingEnrollment();
    if (enrollment) {
      setPendingEnrollment(enrollment);

      // If user is a parent → show child selector first
      // If user is an athlete → go directly to payment
      if (profile?.role === 'parent') {
        setShowChildSelector(true);
      } else {
        // Athlete enrolling themselves
        setShowPaymentModal(true);
      }
    }
  }, [profile]);

  const handleChildSelected = (childId: string, childName: string) => {
    setSelectedChildId(childId);
    setSelectedChildName(childName);
    setShowChildSelector(false);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
    if (!pendingEnrollment || !user) return;

    try {
      // Create the enrollment record
      const { error } = await supabase
        .from('enrollments')
        .insert({
          user_id: user.id,
          program_id: pendingEnrollment.programId,
          school_id: pendingEnrollment.schoolId,
          ...(profile?.role === 'athlete' ? {} : { child_id: selectedChildId }),
          start_date: new Date().toISOString().split('T')[0],
          status: 'active',
        });

      if (error) throw error;
    } catch (err) {
      console.error('Error creating enrollment:', err);
    }

    clearPendingEnrollment();
    setPendingEnrollment(null);
    setShowPaymentModal(false);

    toast({
      title: selectedChildName
        ? `🎉 ${selectedChildName} ha sido inscrito/a`
        : '🎉 ¡Inscripción exitosa!',
      description: 'Tu inscripción se ha sincronizado con el calendario',
    });

    // Navigate to calendar to see the new event
    setTimeout(() => {
      navigate('/calendar');
    }, 1500);
  };

  const handleClosePayment = (open: boolean) => {
    if (!open) {
      clearPendingEnrollment();
      setPendingEnrollment(null);
      setSelectedChildId(null);
    }
    setShowPaymentModal(open);
  };

  const handleCloseChildSelector = (open: boolean) => {
    if (!open) {
      clearPendingEnrollment();
      setPendingEnrollment(null);
    }
    setShowChildSelector(open);
  };

  if (!pendingEnrollment) return null;

  return (
    <>
      {/* Step 1: Select child (parents only) */}
      <ChildSelectorModal
        open={showChildSelector}
        onOpenChange={handleCloseChildSelector}
        programId={pendingEnrollment.programId}
        programName={pendingEnrollment.programName}
        schoolId={pendingEnrollment.schoolId}
        schoolName={pendingEnrollment.schoolName}
        onChildSelected={handleChildSelected}
      />

      {/* Step 2: Payment */}
      <PaymentModal
        open={showPaymentModal}
        onOpenChange={handleClosePayment}
        item={{
          type: 'enrollment',
          id: pendingEnrollment.programId,
          name: selectedChildName
            ? `${pendingEnrollment.programName} — ${selectedChildName}`
            : pendingEnrollment.programName,
          description: pendingEnrollment.schoolName,
          amount: pendingEnrollment.amount,
          schoolId: pendingEnrollment.schoolId,
          programId: pendingEnrollment.programId,
        }}
        onSuccess={handlePaymentSuccess}
      />
    </>
  );
}
