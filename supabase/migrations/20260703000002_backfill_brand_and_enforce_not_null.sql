UPDATE public.turnstile_devices SET brand = 'ZKTeco' WHERE brand IS NULL;
ALTER TABLE public.turnstile_devices ALTER COLUMN brand SET DEFAULT 'Genérico';
ALTER TABLE public.turnstile_devices ALTER COLUMN brand SET NOT NULL;
