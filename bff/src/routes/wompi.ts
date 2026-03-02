import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../config/supabase';

const router = Router();

const WOMPI_EVENTS_SECRET = process.env.VITE_WOMPI_EVENTS_SECRET || 'YOUR_WOMPI_SECRET';

router.post('/webhook', async (req: Request, res: Response) => {
    try {
        const body = req.body;
        const { event, data, signature, timestamp } = body;

        req.log?.info({ event }, 'Wompi webhook received');

        // 1. Validate Checksum
        if (signature && signature.checksum) {
            const checksum = signature.checksum;
            const properties = signature.properties || [];

            const values: string[] = [];

            for (const prop of properties) {
                const keys = prop.split('.');
                let value: any = data;

                for (const key of keys) {
                    if (typeof value === 'object' && value !== null) {
                        value = value[key];
                    } else {
                        value = '';
                        break;
                    }
                }
                // Append the resolved value (or empty string if not found)
                values.push(String(value || ''));
            }

            // Finally, append timestamp and secret
            values.push(String(timestamp || ''));
            values.push(WOMPI_EVENTS_SECRET);

            const rawChecksum = values.join('');
            const expectedChecksum = crypto.createHash('sha256').update(rawChecksum).digest('hex');

            if (checksum !== expectedChecksum) {
                req.log?.warn('Wompi webhook checksum mismatch!');
                return res.status(401).json({ error: 'Invalid checksum' });
            }

            req.log?.info('Wompi webhook checksum validated successfully');
        }

        // 2. Process the event
        if (event === 'transaction.updated') {
            const transaction = data?.transaction || {};
            const txId = transaction.id || '';
            const txStatus = transaction.status || '';
            const txReference = transaction.reference || '';
            const txAmount = transaction.amount_in_cents || 0;

            req.log?.info(
                `Wompi TX update: id=${txId}, status=${txStatus}, ref=${txReference}, amount=${txAmount}`
            );

            // Map Wompi status to our payment status
            const statusMap: Record<string, string> = {
                'APPROVED': 'paid',
                'DECLINED': 'rejected',
                'VOIDED': 'refunded',
                'ERROR': 'failed',
                'PENDING': 'pending',
            };
            const paymentStatus = statusMap[txStatus] || 'pending';

            // 3. Update the `payments` record in Supabase
            // Note: Since this is identical to Python logic, we use the `payments` table
            // and query by `receipt_number` which matches `txReference`.
            const { error } = await supabase
                .from('payments')
                .update({
                    status: paymentStatus,
                    payment_date: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('receipt_number', txReference);

            if (error) {
                req.log?.error({ err: error, txReference }, 'Failed to update payment status in Supabase');
                // Even on DB error we usually return 200 so Wompi doesn't retry unnecessarily
                // UNLESS it's a conflict we want Wompi to retry. Python code did not throw 500 here to Wompi.
            } else {
                req.log?.info({ txReference, paymentStatus }, 'Payment successfully updated in Supabase');
            }
        }

        return res.status(200).json({ status: 'ok', event, processed: true });

    } catch (err: any) {
        req.log?.error({ err: err.message || err }, 'Unexpected error in Wompi webhook');
        // Vuelve a lanzar el error genérico si algo explota
        return res.status(500).json({ status: 'error', message: err.message || 'Internal server error' });
    }
});

export default router;
