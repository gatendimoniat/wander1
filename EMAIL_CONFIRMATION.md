# 🔐 Configurar Email de Confirmació a Supabase

## Opció A: Desactivar per a desenvolupament (Recomanat per dev)

1. Ves a https://supabase.com/dashboard/project/onndfsuqkpxljvvwvrxc
2. **Authentication** → **Providers** → **Email**
3. Desactiva **Confirm email**
4. Fes clic a **Save**

Ara els usuaros es poden registrar i fer login sense verificar l'email.

## Opció B: Mantenir activat (Producció)

Si vols mantenir la verificació:
1. Ves a **Authentication** → **Email Templates**
2. Personalitza el template de confirmació
3. Assegura't que l'email redirect URL sigui correcte:
   - **Authentication** → **URL Configuration**
   - Redirect URL: `http://localhost:5173/` (dev) o la teva URL de producció

## Verificació
- Registra un nou usuari amb email/password
- Hauries de poder fer login directament (Opció A)
- O rebre un email de confirmació (Opció B)
