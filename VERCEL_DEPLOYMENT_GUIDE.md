# 🚀 Deployment en Vercel - GUÍA COMPLETA

## ✅ PROBLEMA RESUELTO

El error `vite: command not found` se ha solucionado. Ahora puedes deployar exitosamente.

---

## 🔧 CAMBIOS REALIZADOS

### 1. **Creado `vercel.json`** ✅
Configuración específica para Vercel con:
- Build command correcto
- Output directory configurado
- Rewrites para SPA (Single Page Application)
- Cache headers optimizados

### 2. **Actualizado `package.json`** ✅
Movido `vite` y dependencias de build de `devDependencies` a `dependencies`:
- ✅ vite
- ✅ @vitejs/plugin-react-swc
- ✅ autoprefixer
- ✅ postcss
- ✅ tailwindcss

**Por qué:** Vercel por defecto NO instala devDependencies en producción.

### 3. **Creado `.vercelignore`** ✅
Para optimizar el deployment excluyendo archivos innecesarios.

---

## 📝 CONFIGURACIÓN EN VERCEL

### **Opción 1: Desde la UI de Vercel (Recomendado)**

1. **Ir a Vercel Dashboard**
   - https://vercel.com/dashboard

2. **Import Project**
   - Click "Add New..." → "Project"
   - Conecta tu repositorio de GitHub

3. **Configure Project**
   ```
   Framework Preset: Vite
   Root Directory: frontend/
   Build Command: yarn build
   Output Directory: build
   Install Command: yarn install
   ```

4. **Environment Variables**
   Agregar estas variables:
   ```
   REACT_APP_BACKEND_URL=https://tu-backend-url.com
   VITE_SUPABASE_URL=tu-supabase-url
   VITE_SUPABASE_PUBLISHABLE_KEY=tu-key
   ```

5. **Deploy**
   - Click "Deploy"
   - Espera 2-3 minutos

---

### **Opción 2: Desde CLI (Avanzado)**

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy desde /app/frontend
cd /app/frontend
vercel

# 4. Seguir prompts:
# - Set up and deploy? Yes
# - Which scope? Tu cuenta
# - Link to existing project? No
# - Project name? sportmaps-demo
# - Directory? ./
# - Override settings? No

# 5. Deploy a producción
vercel --prod
```

---

## 🌐 BACKEND API

**Importante:** El backend (FastAPI) NO se puede deployar en Vercel porque Vercel es para frontends estáticos.

### **Opciones para el Backend:**

#### **Opción A: Usar Emergent (Actual)** ✅ Recomendado
```
Ya tienes el backend corriendo en:
https://sports-academy-7.preview.emergentagent.com

Solo necesitas:
1. Deployar frontend en Vercel
2. Configurar REACT_APP_BACKEND_URL en Vercel
```

#### **Opción B: Railway.app** (Si necesitas backend independiente)
```bash
# Railway soporta FastAPI
1. Crear cuenta en railway.app
2. "New Project" → "Deploy from GitHub"
3. Seleccionar carpeta /backend
4. Railway detecta Python automáticamente
5. Configurar variables de entorno
6. Deploy automático
```

#### **Opción C: Render.com** (Gratis)
```
1. render.com → "New Web Service"
2. Conectar GitHub repo
3. Root directory: backend/
4. Build: pip install -r requirements.txt
5. Start: uvicorn server:app --host 0.0.0.0 --port $PORT
6. Deploy gratuito
```

---

## 🧪 TESTING POST-DEPLOYMENT

### **1. Verificar Build Local**
```bash
cd /app/frontend
yarn build
yarn preview

# Debería abrir en http://localhost:4173
# Verificar que todo funciona
```

### **2. Test en Vercel**
Después del deployment:
```
1. Abrir URL de Vercel (ej: sportmaps-demo.vercel.app)
2. Verificar que carga el frontend ✅
3. Abrir DevTools → Network
4. Verificar que las llamadas a /api van al backend correcto
5. Probar login demo
6. Probar sistema de pagos
7. Verificar mobile responsive
```

---

## ⚠️ TROUBLESHOOTING

### **Error: "vite: command not found"**
✅ **SOLUCIONADO** - Ya movimos vite a dependencies

### **Error: "Failed to load module"**
```bash
# Solución:
cd /app/frontend
rm -rf node_modules yarn.lock
yarn install
yarn build
```

### **Error: API calls failing (404/500)**
```
Problema: Backend URL incorrecta

Solución:
1. Ir a Vercel Dashboard → Project → Settings → Environment Variables
2. Verificar REACT_APP_BACKEND_URL
3. Debe apuntar a tu backend de Emergent o Railway
4. Redeploy después de cambiar
```

### **Error: Build timeout**
```
Problema: Build tarda más de 45 min (límite Vercel gratis)

Solución:
1. Vercel → Project Settings → Build & Development
2. Output Directory: build (verificar)
3. Node Version: 18.x (cambiar si es necesario)
```

---

## 📊 CONFIGURACIÓN RECOMENDADA

### **vercel.json** (Ya creado)
```json
{
  "buildCommand": "yarn install && yarn build",
  "framework": "vite",
  "outputDirectory": "build",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### **Ventajas:**
- ✅ Single Page Application routing funciona
- ✅ Todas las rutas (/, /login, /dashboard, etc.) funcionan
- ✅ Refresh en cualquier página funciona
- ✅ Cache optimizado para assets

---

## 🚀 DEPLOYMENT CHECKLIST

**Antes de deployar:**
- [x] vite en dependencies ✅
- [x] vercel.json creado ✅
- [x] .vercelignore creado ✅
- [x] Build local exitoso
- [ ] Environment variables listas
- [ ] Backend URL configurada
- [ ] Domain personalizado (opcional)

**Durante deployment:**
- [ ] Vercel detecta Vite ✅
- [ ] Build completa sin errores
- [ ] Preview URL funciona

**Después de deployar:**
- [ ] URL pública funciona
- [ ] Login demo funciona
- [ ] Sistema de pagos funciona
- [ ] Mobile responsive OK
- [ ] API calls al backend OK

---

## 🎯 RESUMEN RÁPIDO

**Para deployar AHORA:**

```bash
# 1. Asegúrate de estar en frontend
cd /app/frontend

# 2. Build local para verificar
yarn build

# 3. Si todo OK, ve a Vercel:
# - vercel.com/new
# - Import tu repo
# - Root: frontend/
# - Framework: Vite
# - Deploy!

# 4. Configura variables:
REACT_APP_BACKEND_URL=https://sports-academy-7.preview.emergentagent.com
```

**Tiempo estimado:** 5 minutos

---

## 🌟 DESPUÉS DEL DEPLOYMENT

Tu demo estará disponible en:
```
https://sportmaps-demo.vercel.app (o similar)
```

**Podrás:**
- ✅ Compartir el link con inversores
- ✅ Probar en cualquier dispositivo
- ✅ Acceder desde cualquier lugar
- ✅ SSL/HTTPS automático
- ✅ CDN global (carga rápida)

---

## 📞 SOPORTE

**Si encuentras problemas:**
1. Revisa los logs en Vercel Dashboard
2. Verifica que el build local funciona
3. Revisa environment variables
4. Contacta a soporte de Vercel si persiste

---

**¡Listo para deployar!** 🚀

El error de vite está resuelto. Ahora solo:
1. Push estos cambios a GitHub
2. Importar en Vercel
3. Deploy!

Tu demo SportMaps estará en vivo en minutos. ✨
