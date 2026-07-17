import { Check } from 'lucide-react';

interface StepIndicatorProps {
  steps: { label: string; icon: React.ReactNode }[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
        {/* Progress line */}
        <div
          className="absolute top-5 left-0 h-0.5 step-line transition-all duration-500"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isClickable = index <= currentStep;

          return (
            <button
              key={index}
              onClick={() => isClickable && onStepClick?.(index)}
              disabled={!isClickable}
              className={`relative flex flex-col items-center gap-2 z-10 transition-all ${
                isClickable ? 'cursor-pointer' : 'cursor-not-allowed'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-gradient-to-br from-primary to-accent-purple text-white shadow-lg shadow-primary/30'
                    : isActive
                    ? 'bg-gradient-to-br from-primary to-accent-purple text-white shadow-lg shadow-primary/30 ring-4 ring-primary/20'
                    : 'bg-surface border-2 border-border text-muted'
                }`}
              >
                {isCompleted ? <Check size={18} /> : step.icon}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted'
                }`}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
