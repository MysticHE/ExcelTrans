import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import Step1_Upload from './Step1_Upload';
import Step2_SheetSelector from './Step2_SheetSelector';
import Step3_ColumnMapper from './Step3_ColumnMapper';
import Step4_RuleBuilder from './Step4_RuleBuilder';
import Step5_OutputConfig from './Step5_OutputConfig';
import { cn } from '../ui';

const STEPS = [
  { num: 1, label: 'Upload' },
  { num: 2, label: 'Sheets' },
  { num: 3, label: 'Columns' },
  { num: 4, label: 'Rules' },
  { num: 5, label: 'Output' },
];

function StepIndicator({ currentStep, onGoTo }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, i) => {
        const isDone = step.num < currentStep;
        const isCurrent = step.num === currentStep;
        return (
          <React.Fragment key={step.num}>
            <button
              onClick={() => isDone && onGoTo(step.num)}
              disabled={!isDone}
              className={cn(
                'flex flex-col items-center group focus:outline-none',
                isDone ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                  isCurrent && 'ring-4 ring-indigo-500/20',
                  isDone
                    ? 'bg-indigo-500 text-white group-hover:bg-indigo-600 shadow-sm'
                    : isCurrent
                      ? 'bg-indigo-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300'
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <span>{step.num}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs mt-1.5 font-medium transition-colors',
                  isCurrent ? 'text-indigo-600' : isDone ? 'text-indigo-400' : 'text-gray-400'
                )}
              >
                {step.label}
              </span>
            </button>

            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-3 mb-5 relative bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: step.num < currentStep ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function WizardContainer({ wizard, aiConfig }) {
  const { state, goToStep } = wizard;
  const stepProps = { wizard, aiConfig };

  return (
    <div>
      <StepIndicator currentStep={state.step} onGoTo={goToStep} />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {state.step === 1 && <Step1_Upload {...stepProps} />}
            {state.step === 2 && <Step2_SheetSelector {...stepProps} />}
            {state.step === 3 && <Step3_ColumnMapper {...stepProps} />}
            {state.step === 4 && <Step4_RuleBuilder {...stepProps} />}
            {state.step === 5 && <Step5_OutputConfig {...stepProps} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
