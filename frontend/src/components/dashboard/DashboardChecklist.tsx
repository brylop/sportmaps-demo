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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Configuración de tu cuenta</h2>
                    <p className="text-sm text-slate-500">Completa estos pasos para activar todas las funciones.</p>
                </div>
                <div className="text-right">
                    <span className="text-2xl font-bold text-blue-600">{progress}%</span>
                    <div className="w-32 h-2 bg-slate-100 rounded-full mt-1">
                        <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-500"
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
                                ? 'bg-slate-50 border-slate-200 opacity-75'
                                : 'bg-white border-blue-100 hover:border-blue-300 shadow-sm'
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            {step.completed ? (
                                <CheckCircle2 className="w-6 h-6 text-green-500" />
                            ) : (
                                <Circle className="w-6 h-6 text-blue-300" />
                            )}
                            <div className="text-left">
                                <p className={`font-semibold ${step.completed ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                    {step.title}
                                </p>
                                <p className="text-xs text-slate-500">{step.description}</p>
                            </div>
                        </div>
                        {!step.completed && <ArrowRight className="w-5 h-5 text-blue-400" />}
                    </button>
                ))}
            </div>
        </div>
    );
};
