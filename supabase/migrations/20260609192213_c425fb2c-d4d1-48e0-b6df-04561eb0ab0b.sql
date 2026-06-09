ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_confirmed_at timestamp with time zone;

COMMENT ON COLUMN public.profiles.whatsapp_confirmed_at IS 'Marca quando o participante confirmou/cadastrou o WhatsApp no aviso obrigatório.';