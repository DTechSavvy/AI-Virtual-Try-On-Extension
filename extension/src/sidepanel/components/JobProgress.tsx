import React from 'react';
import { TryOnJob, TryOnJobStatus } from '@vton/shared';

interface JobProgressProps {
  job: TryOnJob;
  onCancel?: () => void;
  onRetry?: () => void;
}

const STAGES = [
  { id: 'QUEUED', label: 'Queued for processing', desc: 'Waiting in dispatch queue' },
  { id: 'PREPARING_ASSETS', label: 'Preparing model & garment', desc: 'Fetching profile photo & product image' },
  { id: 'AI_SYNTHESIS', label: 'AI virtual try-on synthesis', desc: 'Neural network fitting garment to model' },
  { id: 'STORING_RESULT', label: 'Finalizing visualization', desc: 'Validating quality and securing result' },
];

export const JobProgress: React.FC<JobProgressProps> = ({ job, onRetry }) => {
  const currentStage = job.currentStage || 'QUEUED';
  const progressPercent = job.progressPercent || 15;
  const isFailed = job.status === TryOnJobStatus.FAILED;

  const getStageIndex = (stage: string) => {
    switch (stage) {
      case 'QUEUED':
        return 0;
      case 'PREPARING_ASSETS':
        return 1;
      case 'AI_SYNTHESIS':
        return 2;
      case 'STORING_RESULT':
      case 'COMPLETED':
        return 3;
      default:
        return 0;
    }
  };

  const activeIndex = getStageIndex(currentStage);

  return (
    <div className="glass-panel" style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Virtual Try-On In Progress
          </span>
          <h3 style={{ fontSize: '14px', fontWeight: '700', marginTop: '2px' }}>
            {isFailed ? 'Generation Encountered An Issue' : 'Synthesizing Your Look...'}
          </h3>
        </div>
        {!isFailed && (
          <div
            style={{
              width: '22px',
              height: '22px',
              border: '2px solid rgba(99, 102, 241, 0.25)',
              borderTopColor: '#6366f1',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        )}
      </div>

      {/* Progress Bar */}
      <div>
        <div
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${isFailed ? 100 : progressPercent}%`,
              height: '100%',
              backgroundColor: isFailed ? '#ef4444' : '#6366f1',
              borderRadius: '4px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>{isFailed ? 'Failed' : `${progressPercent}% Complete`}</span>
          <span>{job.providerUsed ? `Powered by ${job.providerUsed}` : 'AI Neural Engine'}</span>
        </div>
      </div>

      {/* Stepper Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {STAGES.map((step, idx) => {
          const isDone = activeIndex > idx && !isFailed;
          const isCurrent = activeIndex === idx && !isFailed;
          const isPending = activeIndex < idx && !isFailed;

          let icon = '○';
          let textColor = 'var(--text-muted)';
          let dotBg = 'rgba(255, 255, 255, 0.1)';

          if (isDone) {
            icon = '✓';
            textColor = '#f8fafc';
            dotBg = '#10b981';
          } else if (isCurrent) {
            icon = '●';
            textColor = '#818cf8';
            dotBg = '#6366f1';
          } else if (isFailed && activeIndex === idx) {
            icon = '✕';
            textColor = '#fca5a5';
            dotBg = '#ef4444';
          }

          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: dotBg,
                  color: '#fff',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              >
                {icon}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', fontWeight: isCurrent ? '700' : '500', color: textColor }}>
                  {step.label}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {isCurrent ? step.desc : isDone ? 'Finished' : isPending ? 'Pending' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Details & Retry */}
      {isFailed && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            padding: '10px 12px',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <p style={{ fontSize: '12px', color: '#fca5a5', lineHeight: '1.4' }}>
            {job.errorMessage || 'Virtual try-on could not be completed. Please try again with a clear photo.'}
          </p>
          {onRetry && (
            <button onClick={onRetry} className="btn-primary" style={{ alignSelf: 'flex-start', padding: '6px 12px', fontSize: '11px' }}>
              Retry Try-On
            </button>
          )}
        </div>
      )}
    </div>
  );
};
