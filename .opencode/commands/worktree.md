---
description: Crea un git worktree en .worktrees/ con un nombre derivado del contexto del argumento del usuario.
agent: build
---

El usuario invoca `/worktree` seguido de una descripción que puede contener espacios.

Tu única tarea:

1. Toma el argumento del usuario: $ARGUMENTS
2. Analiza el contexto de esa descripción y deriva un nombre de worktree en formato **kebab-case**: minúsculas, sin acentos, sin espacios, sin caracteres especiales, palabras separadas por guiones. El nombre debe reflejar el propósito o tema de la descripción (no traducirse literalmente). Mantenlo conciso (1-4 palabras).
3. Ejecuta ÚNICAMENTE este comando con la herramienta Bash, sin `cd`, sin cambiar de directorio, sin pasos adicionales:

   ```
   git worktree add .worktrees/<nombre-del-worktree>
   ```

4. No hagas nada más: no edites archivos, no modifiques .gitignore, no hagas commits, no imprimas resúmenes, no cambies de directorio. Solo retorna el resultado del comando.

Si el argumento está vacío, pide al usuario que describa el propósito del worktree antes de continuar.