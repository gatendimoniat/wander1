# 📋 Instruccions per executar SQL a Supabase

## Pas 1: Accedeix al SQL Editor
1. Ves a https://supabase.com/dashboard/project/onndfsuqkpxljvvwvrxc
2. Fes clic a **SQL Editor** al menú lateral
3. Fes clic a **New query**

## Pas 2: Copia i enganxa el SQL
1. Obre el fitxer `supabase-schema.sql` del projecte
2. Copia **TOT** el contingut
3. Enganxa'l al SQL Editor

## Pas 3: Executa
1. Fes clic a **Run** (o Ctrl+Enter)
2. Hauries de veure "Success. No rows returned" o similar

## Verificació
Un cop executat, verifica que les taules existeixen:
1. Ves a **Table Editor** al menú lateral
2. Hauries de veure les taules `routes` i `tracks`
3. Fes clic a cadascuna per verificar l'estructura

## Què crea el SQL?
- ✅ Taula `routes` (id, user_id, name, points, created_at, updated_at)
- ✅ Taula `tracks` (id, user_id, name, positions, distance, elevation_gain/loss, max/min_altitude, difficulty, created_at, updated_at)
- ✅ Row Level Security (RLS) - cada usuari només veu les seves dades
- ✅ Índexos per performance
- ✅ Trigger auto-update per `updated_at`

## Si hi ha errors
- Si diu "policy already exists": el SQL ja és idempotent, torna a executar
- Si diu "relation already exists": les taules ja existeixen, ignora l'error
- Si diu "permission denied": verifica que estàs loguejat com a admin del projecte
