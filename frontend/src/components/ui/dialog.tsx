import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Puntero "grueso" = pantalla táctil (celular o tablet). */
const isCoarsePointer = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * `variant="sheet"` — formulario largo con encabezado y pie fijos.
 *
 * El modal por defecto hace scroll en el propio DialogContent (`.dialog-safe`:
 * overflow + padding inferior). Un pie `sticky bottom-0` adentro de ese scroll
 * deja pasar los campos por debajo y por el padding de abajo (bug «Añadir Hijo»,
 * 2026-10-24: «Selecciona una fecha» asomaba bajo «Cancelar / Siguiente»).
 *
 * Con `sheet` el contenedor NO hace scroll: es una columna flex con
 * DialogHeader (fijo) · DialogBody (scroll propio) · DialogFooter (fijo, fondo
 * opaco). En celular es una hoja desde abajo (`max-h-sheet`); desde md, el modal
 * centrado de siempre con el mismo alto máximo. Es opcional: los demás modales
 * no cambian.
 */
type DialogVariant = "default" | "sheet";
const DialogVariantContext = React.createContext<DialogVariant>("default");

const SHEET_CLASSES = cn(
  // Celular: hoja pegada abajo, ancho completo, alto máximo de hoja.
  "fixed inset-x-0 bottom-0 z-50 flex w-full min-w-0 max-h-sheet flex-col gap-0 overflow-hidden rounded-t-2xl border bg-background p-0 pb-safe-b shadow-lg duration-200",
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  // md+: modal centrado (misma animación que el modal por defecto).
  "md:inset-x-auto md:bottom-auto md:left-[50%] md:top-[50%] md:max-w-lg md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-lg md:pb-0",
  "md:data-[state=open]:zoom-in-95 md:data-[state=closed]:zoom-out-95 md:data-[state=open]:slide-in-from-left-1/2 md:data-[state=open]:slide-in-from-top-[48%] md:data-[state=closed]:slide-out-to-left-1/2 md:data-[state=closed]:slide-out-to-top-[48%]",
);

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { variant?: DialogVariant }
>(({ className, children, onOpenAutoFocus, variant = "default", ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogVariantContext.Provider value={variant}>
    <DialogPrimitive.Content
      ref={ref}
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event);
        // En pantallas táctiles Radix enfocaría el primer campo del diálogo y
        // eso levanta el teclado apenas se abre, tapando la mitad del contenido
        // (Android, "Inscribir Deportistas", reporte Athletic League 2026-09-24).
        // El foco pasa al propio diálogo (sigue siendo accesible) y el teclado
        // sale solo cuando la persona toca un campo. En escritorio no cambia nada.
        if (!event.defaultPrevented && isCoarsePointer()) {
          event.preventDefault();
          (event.target as HTMLElement | null)?.focus?.();
        }
      }}
      className={cn(
        variant === "sheet"
          ? SHEET_CLASSES
          : cn(
              "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
              // PWA/iOS: nunca superar el alto visible ni tapar los botones tras el home indicator.
              // Limita la altura al viewport dinámico, permite scroll interno y respeta el safe-area inferior.
              "dialog-safe",
            ),
        className,
      )}
      {...props}
    >
      {children}
      {/* top-[max(...)] en vez de top-4: en iOS nativo, cuando el diálogo es
          alto y el teclado reduce el viewport visible, el borde superior del
          diálogo puede coincidir con la barra de estado/notch — el botón de
          cerrar quedaba tapado detrás. Ver también .dialog-safe (safe-area
          inferior) en index.css. La hoja (`sheet`) nunca toca el borde de
          arriba, así que ahí basta top-4. */}
      <DialogPrimitive.Close
        className={cn(
          "absolute rounded-sm p-2 opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none",
          variant === "sheet"
            ? "right-4 top-4"
            : "right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))]",
        )}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
    </DialogVariantContext.Provider>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const variant = React.useContext(DialogVariantContext);
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left",
        // En la hoja: fijo arriba; pr-12 deja libre la X de cerrar.
        variant === "sheet" && "shrink-0 px-gutter pb-2 pr-12 pt-6 sm:px-6 sm:pr-12",
        className,
      )}
      {...props}
    />
  );
};
DialogHeader.displayName = "DialogHeader";

/** Cuerpo con scroll propio. Solo tiene sentido dentro de `variant="sheet"`. */
const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-gutter py-4 sm:px-6", className)} {...props} />
);
DialogBody.displayName = "DialogBody";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const variant = React.useContext(DialogVariantContext);
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        // En la hoja: fijo abajo, fondo opaco y borde que lo separa del cuerpo.
        variant === "sheet" && "shrink-0 border-t bg-background px-gutter py-3 sm:px-6 sm:py-4",
        className,
      )}
      {...props}
    />
  );
};
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
