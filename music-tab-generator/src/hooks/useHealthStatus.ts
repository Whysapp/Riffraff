import { useState, useEffect, useCallback } from 'react';

export type HealthStatus = 'online' | 'down' | 'checking' | 'unknown';

interface HealthResponse {
  status: HealthStatus;
  message: string;
  timestamp: string;
}

export function useHealthStatus(checkInterval = 60000) { // Check every 60 seconds
  const [status, setStatus] = useState<HealthStatus>('unknown');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    setStatus('checking');
    
    try {
      const response = await fetch('/api/stems/health', {
        cache: 'no-store',
      });
      
      const data: HealthResponse = await response.json();
      setStatus(data.status);
      setLastChecked(new Date());
    } catch (error) {
      setStatus('down');
      setLastChecked(new Date());
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  useEffect(() => {
    // Check immediately on mount
    checkHealth();
    
    // Set up interval for periodic checks
    const interval = setInterval(checkHealth, checkInterval);
    
    return () => clearInterval(interval);
  }, [checkHealth, checkInterval]);

  return {
    status,
    lastChecked,
    isChecking,
    checkHealth,
  };
}