# ⚡ GUÍA RÁPIDA - Arreglar Vercel AHORA

## 🎯 EL PROBLEMA

Tu deployment en Vercel falla con "vite: command not found" porque:
1. Conflicto entre npm y yarn
2. Faltaba especificar versión de Node.js
3. Vercel no sabía qué package manager usar

## ✅ LO QUE YA SE HIZO

1. ✅ Agregado `engines` a package.json (Node 18.x)
2. ✅ Cambiado vercel.json para usar `npm` en lugar de `yarn`
3. ✅ Creado `.npmrc` para configuración correcta
4. ✅ Logo ya es SportMaps (NO hay logo de Lovable)

## 🚀 LO QUE TIENES QUE HACER (5 MINUTOS)

### **PASO 1: Push a GitHub** (2 min)

```bash
cd /app
git add .
git commit -m "fix: Node.js engines and npm for Vercel"
git push origin main
```

### **PASO 2: Configurar Vercel** (3 min)

**Ir a:** https://vercel.com/dashboard → Tu proyecto → Settings → General

**Cambiar estos valores:**

| Setting | Valor ANTERIOR | Valor NUEVO |
|---------|---------------|-------------|
| Root Directory | `./` o vacío | **`frontend`** |
| Framework | Other | **`Vite`** |
| Build Command | (cualquier cosa) | **`npm run build`** |
| Output Directory | frontend/build | **`build`** |
| Install Command | (cualquier cosa) | **`npm install`** |
| Node.js Version | (cualquier) | **`18.x`** |

**Click "Save"**

### **PASO 3: Environment Variables**

Settings → Environment Variables

**Verificar que existe:**
```
REACT_APP_BACKEND_URL = https://sportmaps-db.preview.emergentagent.com
```

Si no existe, agregar.

### **PASO 4: Limpiar Cache y Redeploy**

```
Settings → Clear Build Cache → Click "Clear Cache and Retry Deployment"
```

O si no funciona:
```
Deployments → Click en el último → Menu "..." → Redeploy
```

---

## ⏱️ ESPERAR 3-5 MINUTOS

Verás algo como:

```
✓ Cloning repository
✓ Analyzing source code
✓ Installing dependencies (npm install)
✓ Building (npm run build)
✓ Deploying
✓ Ready! https://sportmaps-demo.vercel.app
```

---

## ✅ VERIFICAR QUE FUNCIONA

1. **Abrir:** https://sportmaps-demo.vercel.app
2. **Debe mostrar:** Página principal de SportMaps (NO en blanco)
3. **Logo:** Debe ser el de SportMaps (verde/blanco)
4. **Probar:** Click en "Probar Demo"
5. **Debe funcionar:** Login, dashboard, todo

---

## 🆘 SI AÚN FALLA

### **Plan B: Eliminar vercel.json**

Si después de hacer lo anterior SIGUE fallando:

```bash
cd /app
rm vercel.json
git add .
git commit -m "fix: Remove vercel.json, use Vercel UI config only"
git push origin main
```

Luego en Vercel:
- Clear cache
- Redeploy
- Debería funcionar con la configuración del Dashboard

---

## 📞 SI NADA FUNCIONA

Contacta soporte de Vercel:
- Dashboard → Help → Contact Support
- Diles: "vite build fails with exit code 127, tried npm/yarn, specified Node 18.x, still fails"
- Adjunta logs del deployment

---

## 📊 CHECKLIST

- [ ] Push a GitHub ✅
- [ ] Root Directory = `frontend` ✅
- [ ] Framework = `Vite` ✅
- [ ] Build Command = `npm run build` ✅
- [ ] Output = `build` ✅
- [ ] Install = `npm install` ✅
- [ ] Node = `18.x` ✅
- [ ] Env Var configurada ✅
- [ ] Cache limpiado ✅
- [ ] Redeploy iniciado ✅
- [ ] Build exitoso (esperar 3-5 min) ⏳
- [ ] URL funciona ⏳

---

## 🎉 RESULTADO ESPERADO

**URL:** https://sportmaps-demo.vercel.app
**Estado:** ✅ Funciona
**Logo:** ✅ SportMaps (verde)
**Demo:** ✅ Todo operativo

---

**¡Con estos cambios DEBERÍA funcionar!** 🚀

La clave: Node 18.x + npm + Root=frontend + Framework=Vite
