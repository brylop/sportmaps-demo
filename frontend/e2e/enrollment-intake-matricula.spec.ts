// frontend/e2e/enrollment-intake-matricula.spec.ts
//
// Camino feliz del flujo "alta de atleta por foto de hoja de matrícula"
// (docs/specs/alta-atleta-por-foto-hoja-matricula.md, fases 1-4, commits
// 163ba786..1d06c55c).
//
// Playwright no puede simular el envío real por WhatsApp (eso vive en
// bff/src/jobs/whatsapp-queue.job.ts, fuera del alcance del navegador), así
// que el test arranca DESPUÉS de ese punto: siembra directo en
// `enrollment_form_intake` con status='waiting_review' y un `extracted` como
// el que dejaría el OCR (fase 2), tal como pide la tarea. Desde ahí sigue el
// camino real: inbox (fase 4) -> POST /students/create-one -> POST
// /enrollment-intake/:id/mark-approved.
//
// Requiere en el entorno (o en bff/.env, de donde se cargan si no están
// exportados):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — para sembrar el intake
// Ambiente: dev local (npm run dev, localhost:3001 -> bffdev.sportmaps.co),
// contra la escuela real "Escuela Pruebas" (ec26397b-8d08-4534-a3a8-331b757a21f8),
// la única con integración de WhatsApp activa (`school_whatsapp_integrations`).
// Cuenta: meta.reviewer@sportmaps.co (school_admin de esa escuela; creada
// para el App Review de Meta, credenciales en c:\tmp\meta-reviewer-credenciales.txt).
//
// Este test CREA un atleta real (children) y dispara una invitación por
// correo a un dominio de prueba (@sportmaps-test.local, mismo patrón que ya
// usan otras filas de prueba en esta escuela). NO borra los datos que crea al
// terminar — "el usuario maneja las eliminaciones" (memoria del proyecto), no
// los agentes. Queda anotado en el log de consola qué fila limpiar.

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../bff/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ESCUELA_PRUEBAS_ID = 'ec26397b-8d08-4534-a3a8-331b757a21f8';
const INTEGRATION_ID = '838ccd56-4350-46a2-9249-aa1472801191'; // school_whatsapp_integrations activa de Escuela Pruebas

// Cuenta del revisor de Meta: credenciales por variables de entorno, nunca en
// el repo (es público). Sin ellas el spec se salta con un mensaje claro.
const REVIEWER = {
    email: process.env.PLAYWRIGHT_META_REVIEWER_EMAIL || 'meta.reviewer@sportmaps.co',
    password: process.env.PLAYWRIGHT_META_REVIEWER_PASSWORD || '',
};
if (!REVIEWER.password) {
    test.skip(true, 'Falta PLAYWRIGHT_META_REVIEWER_PASSWORD en el entorno');
}

test.describe.configure({ mode: 'serial' });

test.describe('Alta de atleta por foto de hoja de matrícula — inbox de revisión', () => {
    test.skip(!SUPABASE_URL || !SERVICE_ROLE_KEY,
        'Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (export o bff/.env) — no se puede sembrar el intake.');

    const runId = Date.now();
    const athleteName = `QA E2E Matricula ${runId}`;
    const docNumber = `9${String(runId).slice(-9)}`; // patrón claramente ficticio, evita chocar con documentos reales
    const guardianEmail = `qa.e2e.matricula.${runId}@sportmaps-test.local`;
    const waMessageId = `qa-e2e-matricula-${runId}`;

    let admin: ReturnType<typeof createClient>;
    let intakeId: string;

    test.beforeAll(async () => {
        admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

        // Simula lo que dejaría el worker (fase 3) + OCR (fase 2) tras leer
        // la foto de una hoja de matrícula de un MENOR de edad, con todos los
        // campos legibles (camino feliz, sin missingFields).
        const extracted = {
            athleteFullName: athleteName,
            docType: 'TI',
            docNumber,
            dateOfBirth: '2015-03-10',
            dateOfBirthRaw: '10 MARZO 2015',
            ageOnForm: 10,
            category: 'SUB-12',
            guardianFullName: 'Acudiente QA E2E',
            guardianDocNumber: '1000999888',
            guardianPhone: '3001234567',
            guardianEmail,
            athleteEmail: null,
            athletePhone: null,
            epsName: 'SURA',
            bloodType: 'O+',
            isEnrollmentForm: true,
            missingFields: [],
            provider: 'qa-seed',
        };

        const { data, error } = await admin
            .from('enrollment_form_intake')
            .insert({
                school_id: ESCUELA_PRUEBAS_ID,
                integration_id: INTEGRATION_ID,
                wa_message_id: waMessageId,
                wa_phone_number: '573000000000',
                media_id: 'qa-e2e-media-test',
                storage_path: null,
                status: 'waiting_review',
                extracted,
            })
            .select('id')
            .single();

        if (error) throw new Error(`No se pudo sembrar enrollment_form_intake: ${error.message}`);
        intakeId = data!.id as string;
        console.log(`[seed] enrollment_form_intake creada: ${intakeId} (limpiar a mano si hace falta)`);
    });

    test('el admin ve la ficha prellenada, confirma y se crea el atleta', async ({ page }) => {
        // Login programático (mismo patrón que frontend/e2e/helpers/auth.ts,
        // reimplementado inline para no acoplar este spec a PLAYWRIGHT_SUPABASE_*).
        const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: process.env.SUPABASE_ANON_KEY || '',
            },
            body: JSON.stringify({ email: REVIEWER.email, password: REVIEWER.password }),
        });
        if (!tokenRes.ok) {
            const body = await tokenRes.text().catch(() => '');
            throw new Error(`login falló: ${tokenRes.status} ${body}`);
        }
        const tokenData = await tokenRes.json();

        const projectRef = new URL(SUPABASE_URL!).host.split('.')[0];
        const storageKey = `sb-${projectRef}-auth-token`;
        await page.addInitScript(([key, value]) => {
            window.localStorage.setItem(key as string, value as string);
        }, [storageKey, JSON.stringify({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in,
            expires_at: tokenData.expires_at,
            token_type: 'bearer',
            user: tokenData.user,
        })]);

        await page.goto('/school/enrollment-intake');
        await page.waitForLoadState('networkidle');

        await expect(page.getByRole('heading', { name: athleteName, exact: true })).toBeVisible({ timeout: 15_000 });

        // GAP de implementación (ver reporte): los <Label> del inbox no usan
        // htmlFor/id, así que getByLabel() no encuentra los campos (y tampoco
        // lo haría un lector de pantalla). Se escopea al card por el nombre
        // del atleta y se navega Label -> contenedor -> input.
        const card = page.locator('div.rounded-lg.border').filter({ hasText: athleteName });

        const docInput = card.getByText('Documento *', { exact: true }).locator('xpath=ancestor::div[1]//input');
        const emailInput = card.getByText('Correo *', { exact: true }).locator('xpath=ancestor::div[1]//input');

        // Los campos vienen prellenados desde `extracted` — camino feliz, sin
        // missingFields, así que ningún input debería quedar en amarillo.
        await expect(docInput).toHaveValue(docNumber);
        await expect(emailInput).toHaveValue(guardianEmail);

        await page.screenshot({ path: 'e2e/screenshots/enrollment-intake-01-prellenado.png', fullPage: true });

        await card.getByRole('button', { name: 'Crear atleta' }).click();
        await expect(page.getByText('Atleta creado', { exact: true })).toBeVisible({ timeout: 20_000 });

        await page.screenshot({ path: 'e2e/screenshots/enrollment-intake-02-creado.png', fullPage: true });

        // La ficha debe desaparecer del inbox (ya no está en waiting_review).
        await expect(page.getByRole('heading', { name: athleteName, exact: true })).toHaveCount(0, { timeout: 10_000 });
    });

    test('el atleta quedó creado en children con los datos correctos y la ficha en approved', async () => {
        const { data: intake, error: intakeErr } = await admin
            .from('enrollment_form_intake')
            .select('status, child_id, unregistered_athlete_id, reviewed_by')
            .eq('id', intakeId)
            .single();

        expect(intakeErr).toBeNull();
        expect(intake?.status).toBe('approved');
        expect(intake?.child_id).toBeTruthy();

        const { data: child, error: childErr } = await admin
            .from('children')
            .select('full_name, doc_number, doc_type, date_of_birth, school_id')
            .eq('id', intake!.child_id as string)
            .single();

        expect(childErr).toBeNull();
        expect(child?.full_name).toBe(athleteName);
        expect(child?.doc_number).toBe(docNumber);
        expect(child?.school_id).toBe(ESCUELA_PRUEBAS_ID);
        expect(child?.date_of_birth).toBe('2015-03-10');

        console.log(
            `[cleanup pendiente] children.id=${intake!.child_id} ` +
            `enrollment_form_intake.id=${intakeId} — datos de prueba en Escuela Pruebas, ` +
            `a limpiar por el usuario (memoria: "el usuario maneja las eliminaciones").`,
        );
    });
});
