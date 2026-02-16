# 🎫 SportMaps: Guía de Importación para Jira

Para Jira, la mejor forma de recrear el proyecto es mediante una importación masiva usando un archivo **CSV**. He preparado el archivo `jira_import_structure.csv` con los campos necesarios.

## 📂 Archivos Generados
1.  [jira_import_structure.csv](file:///c:/Users/Usuario/Documents/demo/sportmaps-demo/jira_import_structure.csv): Archivo listo para importar.

## 🚀 Pasos para Importar en Jira
1.  Ve a **Configuración (Settings)** -> **Sistema (System)**.
2.  En el panel izquierdo, busca **External System Import**.
3.  Selecciona **CSV**.
4.  Sube el archivo `jira_import_structure.csv`.
5.  **Mapeo de Campos**:
    *   `Summary` -> Summary
    *   `Issue Type` -> Issue Type
    *   `Description` -> Description
    *   `Epic Link` -> Epic Link (o Epic Name si estás importando Epics)
    *   `Component` -> Component
6.  Haz clic en **Begin Import**.

## 🏗️ Jerarquía del Proyecto
El archivo sigue esta estructura:
- **Epics**: Los 8 módulos integrales (Auth, Estudiantes, Académico, etc.).
- **Stories**: Historias de usuario (US 1.1, US 2.1, etc.) vinculadas a sus respectivos Epics.
- **Tasks**: Tareas técnicas divididas por componentes:
    *   **Flutter**: Desarrollo móvil.
    *   **Backend**: Desarrollo en Supabase/FastAPI.

## 💡 Recomendaciones en Jira
- **Backlog**: Jira moverá todo al Backlog por defecto.
- **Sprints**: Crea Sprints basados en las Épicas más críticas (Auth y Estudiantes primero).
- **Tablero Kanban**: Útil para ver el flujo de las tareas de Flutter vs Backend.
