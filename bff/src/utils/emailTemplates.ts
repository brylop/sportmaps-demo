export const EmailTemplates = {
    paymentConfirmation: (parentName: string, amount: string, concept: string, receiptNumber: string) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">¡Pago Recibido!</h1>
        <p>Hola ${parentName},</p>
        <p>Hemos recibido y validado tu pago exitosamente. Aquí están los detalles:</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Concepto:</strong> ${concept}</p>
          <p><strong>Monto:</strong> ${amount}</p>
          <p><strong>Referencia:</strong> ${receiptNumber}</p>
          <p><strong>Estado:</strong> <span style="color: green; font-weight: bold;">Aprobado</span></p>
        </div>
  
        <p>Gracias por confiar en nosotros.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
        <p style="color: #6B7280; font-size: 12px;">SportMaps - Gestión Deportiva</p>
      </div>
    `,

    paymentReminder: (parentName: string, amount: string, childName: string, dueDate: string, paymentLink: string) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #F59E0B;">Recordatorio de Pago</h1>
        <p>Hola ${parentName},</p>
        <p>Este es un recordatorio amable sobre el pago pendiente para la mensualidad de <strong>${childName}</strong>.</p>
        
        <div style="background-color: #FFFBEB; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #FEF3C7;">
          <p><strong>Monto a pagar:</strong> ${amount}</p>
          <p><strong>Fecha límite:</strong> ${dueDate}</p>
        </div>
  
        <a href="${paymentLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Pagar Ahora
        </a>
  
        <p style="margin-top: 20px;">Si ya realizaste el pago, por favor omite este mensaje o envíanos el comprobante.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
        <p style="color: #6B7280; font-size: 12px;">SportMaps - Gestión Deportiva</p>
      </div>
    `,

    welcome: (name: string) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">¡Bienvenido a SportMaps!</h1>
        <p>Hola ${name},</p>
        <p>Estamos emocionados de tenerte con nosotros. Ahora podrás gestionar las actividades deportivas de tus hijos de forma fácil y rápida.</p>
        <p>Explora las escuelas cercanas y encuentra el programa perfecto.</p>
        <a href="https://sportmaps.demo.com/explore" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 10px;">
          Explorar Programas
        </a>
      </div>
    `,

    invitation: (parentName: string, childName: string, schoolName: string, inviteLink: string) => `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #4F46E5;">¡Invitación de ${schoolName}!</h1>
        <p>Hola ${parentName || 'Padre/Madre'},</p>
        <p>La escuela <strong>${schoolName}</strong> ha registrado a <strong>${childName}</strong> en su sistema.</p>
        <p>Para ver el progreso de tu hijo/a, realizar pagos y recibir notificaciones, por favor completa tu registro en SportMaps.</p>
        
        <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <a href="${inviteLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Aceptar Invitación y Crear Cuenta
          </a>
        </div>
  
        <p>Si ya tienes cuenta, el estudiante se asociará automáticamente cuando inicies sesión con este correo.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
        <p style="color: #6B7280; font-size: 12px;">SportMaps - Gestión Deportiva</p>
      </div>
    `
};
