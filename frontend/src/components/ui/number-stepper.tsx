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
        <div className={cn("flex items-center border rounded-md h-10 bg-background overflow-hidden relative", className)}>
            <button
                type="button"
                onClick={handleDecrement}
                className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute left-0 z-10 flex items-center justify-center border-r"
            >
                <Minus className="h-4 w-4" />
            </button>

            {unit && (
                <span className="absolute left-12 text-muted-foreground font-medium z-10 pointer-events-none">
                    {unit}
                </span>
            )}

            <Input
                type="text"
                className={cn(
                    "border-0 text-center font-semibold focus-visible:ring-0 no-spinners",
                    unit ? "pl-16 pr-10" : "px-10"
                )}
                value={displayValue}
                onChange={handleChange}
            />

            <button
                type="button"
                onClick={handleIncrement}
                className="h-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors absolute right-0 z-10 flex items-center justify-center border-l"
            >
                <Plus className="h-4 w-4" />
            </button>
        </div>
    )
}
