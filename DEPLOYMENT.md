# Guía de Despliegue a Firebase

Esta guía detalla los pasos necesarios para subir las actualizaciones del repositorio al hosting de Firebase y los problemas identificados que deben tenerse en cuenta.

## Requisitos Previos

Asegúrate de tener instalada la CLI de Firebase:
```bash
npm install -g firebase-tools
```

## Pasos para el Despliegue

Sigue estos comandos en orden:

1. **Instalar dependencias:**
   Debido a conflictos de versiones en `vite-plugin-pwa` con Vite 8, es necesario usar el flag `--legacy-peer-deps`.
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Construir el proyecto:**
   Esto generará la carpeta `dist` con los archivos optimizados.
   ```bash
   npm run build
   ```

3. **Desplegar a Firebase:**
   ```bash
   firebase deploy
   ```

## Problemas Identificados y Recomendaciones

### 1. Variables de Entorno
El archivo `src/api/firebase.ts` utiliza variables de entorno (ej. `import.meta.env.VITE_FIREBASE_API_KEY`).
**IMPORTANTE:** Asegúrate de configurar estas variables en tu entorno local (archivo `.env`) y en los secretos de GitHub Actions si usas despliegue automatizado.

### 2. Advertencias de Linting
Aunque se corrigieron los errores críticos de "Cannot create components during render", aún existen múltiples advertencias de tipo `any` en TypeScript y algunas dependencias faltantes en `useEffect`.
*   **Recomendación:** Ir tipando progresivamente los objetos `any` para mejorar la robustez del código.

### 3. Tamaño de Chunks
Vite advierte que algunos chunks (ej. `vendor-iyeYvp4W.js`) superan los 500 kB.
*   **Recomendación:** Considerar el uso de importaciones dinámicas (`React.lazy`) para dividir el código y mejorar los tiempos de carga inicial.

## Archivos de Configuración Relevantes
*   `firebase.json`: Configura el hosting (apuntando a `dist`) y las reglas de Firestore/Storage.
*   `.firebaserc`: Define el proyecto de Firebase por defecto (`melo-finances`).
*   `vite.config.ts`: Configuración de construcción y PWA.
