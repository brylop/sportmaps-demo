# 🎯 CONFIGURACIÓN VERCEL - GUÍA RÁPIDA

## ✅ PROBLEMA RESUELTO

El archivo `/app/frontend/vercel.json` que causaba el error **ha sido eliminado**.

El archivo `/app/vercel.json` (raíz) **ha sido actualizado** con la configuración correcta.

---

## 🚀 DEPLOY EN VERCEL - 2 OPCIONES

### **OPCIÓN A: Root Directory = `./` (RECOMENDADA)**

```
1. Ve a Vercel Dashboard → Tu proyecto → Settings → General

2. Configuración:
   Root Directory: ./
   Framework Preset: Other
   Build Command: (dejar VACÍO - usará vercel.json)
   Output Directory: frontend/build
   Install Command: (dejar VACÍO - usará vercel.json)
   Node Version: 18.x

3. Environment Variables:
   Settings → Environment Variables → Add
   REACT_APP_BACKEND_URL = https://sportmaps-db.preview.emergentagent.com

4. Redeploy:
   Deployments → Click último deployment → "..." → Redeploy
```

**Por qué funciona:**
- Vercel empieza en `/app`
- Ejecuta `cd frontend && yarn build` (funciona ✅)
- Toma output de `frontend/build`

---

### **OPCIÓN B: Root Directory = `frontend` (ALTERNATIVA)**

```
1. Ve a Vercel Dashboard → Tu proyecto → Settings → General

2. Configuración:
   Root Directory: frontend
   Framework Preset: Vite
   Build Command: yarn build
   Output Directory: build
   Install Command: yarn install
   Node Version: 18.x

3. Environment Variables:
   Settings → Environment Variables → Add
   REACT_APP_BACKEND_URL = https://sportmaps-db.preview.emergentagent.com

4. Redeploy:
   Deployments → Click último deployment → "..." → Redeploy
```

**Por qué funciona:**
- Vercel empieza en `/app/frontend`
- No hay conflicto con vercel.json (fue eliminado)
- Ejecuta `yarn build` directamente (funciona ✅)

---

## 📋 CHECKLIST

Antes de redeploy, verifica:

- [x] ✅ `/app/frontend/vercel.json` eliminado
- [x] ✅ `/app/vercel.json` actualizado
- [x] ✅ Build local exitoso (4031 modules)
- [ ] ⏳ Environment variable REACT_APP_BACKEND_URL configurada
- [ ] ⏳ Root Directory configurado en Vercel
- [ ] ⏳ Redeploy iniciado

---

## 🔍 VERIFICAR QUE FUNCIONA

Después del deploy (3-5 min):

1. **Abrir URL de Vercel**
   - https://tu-proyecto.vercel.app

2. **Verificar que carga**
   - ✅ Página principal muestra hero
   - ✅ Botones funcionan
   - ✅ No hay pantalla en blanco

3. **Probar login demo**
   - ✅ Click en "Probar Demo"
   - ✅ Tour guiado funciona
   - ✅ Dashboard carga con datos

4. **Verificar Console (F12)**
   - ✅ Sin errores rojos
   - ✅ API calls van al backend correcto

---

## ⚡ SI SIGUE FALLANDO

### **Paso 1: Limpiar cache**
```
Vercel → Settings → Clear Build Cache
Deployments → Redeploy
```

### **Paso 2: Verificar logs**
```
Vercel → Deployments → Click último → Function Logs
Buscar línea exacta del error
```

### **Paso 3: Probar build command manual**
```
En Vercel Settings:
- Si usas Root = ./ → Build Command: cd frontend && yarn build
- Si usas Root = frontend → Build Command: yarn build
```

---

## 💡 RESUMEN

**Lo que cambió:**
- ❌ Eliminado `/app/frontend/vercel.json` (causaba el error)
- ✅ Actualizado `/app/vercel.json` con config correcta
- ✅ Build local funciona perfectamente

**Lo que debes hacer:**
1. Configurar Root Directory en Vercel (`.` o `frontend`)
2. Agregar environment variable REACT_APP_BACKEND_URL
3. Redeploy
4. ✅ ¡Debería funcionar!

---

**Tiempo estimado:** 5 minutos
**Dificultad:** Fácil

¡El error está resuelto! Solo necesitas aplicar la configuración en Vercel. 🚀
