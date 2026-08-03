type RegisterProgressProps = {
  step: 0 | 1 | 2;
  progressLabel: string;
  accountLabel: string;
  businessLabel: string;
  guaranteeLabel: string;
};

type ProgressStepProps = {
  index: 0 | 1 | 2;
  currentStep: 0 | 1 | 2;
  label: string;
};

function ProgressStep({ index, currentStep, label }: ProgressStepProps) {
  const isActive = index === currentStep;
  const isComplete = index < currentStep;

  return (
    <li
      className="flex min-w-0 flex-1 flex-col gap-2"
      aria-current={isActive ? "step" : undefined}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 rounded-full transition-colors motion-reduce:transition-none ${
          isActive || isComplete ? "bg-primary" : "bg-border"
        }`}
      />
      <span
        className={`truncate text-xs font-medium ${
          isActive ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </li>
  );
}

export function RegisterProgress({
  step,
  progressLabel,
  accountLabel,
  businessLabel,
  guaranteeLabel,
}: RegisterProgressProps) {
  return (
    <ol className="flex gap-2" aria-label={progressLabel}>
      <ProgressStep index={0} currentStep={step} label={accountLabel} />
      <ProgressStep index={1} currentStep={step} label={businessLabel} />
      <ProgressStep index={2} currentStep={step} label={guaranteeLabel} />
    </ol>
  );
}
