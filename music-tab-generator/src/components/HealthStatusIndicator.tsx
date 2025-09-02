import { useHealthStatus, type HealthStatus } from '@/hooks/useHealthStatus';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface HealthStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

const statusConfig: Record<HealthStatus, { 
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
}> = {
  online: {
    icon: CheckCircle,
    color: 'text-green-400',
    label: 'Online'
  },
  down: {
    icon: XCircle,
    color: 'text-red-400',
    label: 'Offline'
  },
  checking: {
    icon: Loader2,
    color: 'text-yellow-400',
    label: 'Checking...'
  },
  unknown: {
    icon: AlertCircle,
    color: 'text-gray-400',
    label: 'Unknown'
  }
};

export function HealthStatusIndicator({ 
  className = "", 
  showLabel = true 
}: HealthStatusIndicatorProps) {
  const { status, lastChecked } = useHealthStatus();
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Icon 
        className={`h-4 w-4 ${config.color} ${status === 'checking' ? 'animate-spin' : ''}`} 
      />
      {showLabel && (
        <span className={`text-sm ${config.color}`}>
          Stems service: {config.label}
        </span>
      )}
      {lastChecked && status !== 'checking' && (
        <span className="text-xs text-gray-500">
          ({lastChecked.toLocaleTimeString()})
        </span>
      )}
    </div>
  );
}