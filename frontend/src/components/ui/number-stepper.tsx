import * as React from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "./button"
import { Input } from "./input"
import { cn } from "@/lib/utils"

interface NumberStepperProps {
    value: number | "";
    onChange: (value: number | "") => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    unit?: string;
    formatValue?: (val: number) => string;
}

export function NumberStepper({
    value,
    onChange,
    min = 0,
    max = Infinity,
    step = 1,
    className,
    unit,
    formatValue,
}: NumberStepperProps) {
    const handleDecrement = () => {
        const currentValue = typeof value === "number" ? value : 0;
        const newValue = Math.max(min, currentValue - step);
        onChange(newValue);
    };

    const handleIncrement = () => {
        const currentValue = typeof value === "number" ? value : 0;
        const newValue = Math.min(max, currentValue + step);
        onChange(newValue);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, "");
        if (rawValue === "") {
            onChange("");
            return;
        }
        const numValue = parseInt(rawValue, 10);
        if (!isNaN(numValue)) {
            onChange(Math.min(max, Math.max(min, numValue)));
        }
    };

    const displayValue = typeof value === "number"
        ? (formatValue ? formatValue(value) : value.toLocaleString('es-CO'))
        : "";

    return (
        <div className={cn("flex h-11 items-center bg-background/50 border border-border/40 rounded-xl overflow-hidden group focus-within:border-primary/50 transition-colors", className)}>
            <button
                type="button"
                onClick={handleDecrement}
                className="h-full w-10 flex items-center justify-center border-r border-border/40 hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground shrink-0"
            >
                <Minus className="h-4 w-4" />
            </button>

            <div className="flex-1 relative flex items-center h-full min-w-0">
                <Input
                    type="text"
                    className={cn(
                        "border-0 bg-transparent text-center font-bold text-sm focus-visible:ring-0 focus-visible:ring-offset-0 h-full no-spinners w-full px-2",
                        unit ? "pr-10" : "px-2"
                    )}
                    value={displayValue}
                    onChange={handleChange}
                />
                {unit && (
                    <span className="absolute right-2 text-muted-foreground font-black text-[9px] uppercase tracking-tighter shadow-sm pointer-events-none bg-background/80 px-1 rounded-sm">
                        {unit}
                    </span>
                )}
            </div>

            <button
                type="button"
                onClick={handleIncrement}
                className="h-full w-10 flex items-center justify-center border-l border-border/40 hover:bg-primary/10 hover:text-primary transition-colors text-muted-foreground shrink-0"
            >
                <Plus className="h-4 w-4" />
            </button>
        </div>
    )
}
