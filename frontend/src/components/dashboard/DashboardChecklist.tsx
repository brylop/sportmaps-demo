import React from 'react';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { OnboardingStep } from '../../types/dashboard';

interface Props {
    steps: OnboardingStep[];
    onStepClick: (step: OnboardingStep) => void;
}

export const DashboardChecklist: React.FC<Props> = ({ steps, onStepClick }) => {
    const completedCount = steps.filter(s => s.completed).length;
    const progress = Math.round((completedCount / steps.length) * 100);

    if (steps.length === 0) return null;

    return (
        <div className="bg-white dark:bg-[#0f1a14] rounded-xl shadow-sm dark:shadow-lg border border-slate-200 dark:border-emerald-800/50 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Configuración de tu cuenta</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Completa estos pasos para activar todas las funciones.</p>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{progress}%</span>
                    <div className="w-32 h-2 bg-slate-100 dark:bg-slate-700 rounded-full mt-1">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="grid gap-3">
                {steps.map((step) => (
                    <button
                        key={step.id}
                        onClick={() => onStepClick(step)}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${step.completed
                            ? 'bg-slate-50 dark:bg-[#0a1f12] border-slate-200 dark:border-emerald-900/40 opacity-75'
                            : 'bg-white dark:bg-[#0a1f12] border-emerald-200 dark:border-emerald-800/40 hover:border-emerald-400 dark:hover:border-emerald-600 shadow-sm'
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            {step.completed ? (
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            ) : (
                                <Circle className="w-6 h-6 text-emerald-400 dark:text-emerald-700" />
                            )}
                            <div className="text-left">
                                <p className={`font-semibold ${step.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                                    {step.title}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{step.description}</p>
                            </div>
                        </div>
                        {!step.completed && <ArrowRight className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />}
                    </button>
                ))}
            </div>
        </div>
    );
};
