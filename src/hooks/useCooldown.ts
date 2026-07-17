import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { formatRemainingTime } from '@/utils/cooldown';

export function useCooldown(gridId: string | null, type: 'observation' | 'cleanVote') {
  const cooldowns = useAppStore((state) => 
    type === 'observation' ? state.observationCooldowns : state.cleanVoteCooldowns
  );
  const loadingMap = useAppStore((state) => state.cooldownLoading);
  const syncCooldowns = useAppStore((state) => state.syncCooldowns);

  const [remainingMs, setRemainingMs] = useState(0);

  const expiration = gridId ? cooldowns[gridId] ?? 0 : 0;
  const loading = gridId ? loadingMap[gridId] ?? false : false;

  // Run a timer to tick remaining seconds
  useEffect(() => {
    if (!expiration) {
      setRemainingMs(0);
      return;
    }

    const update = () => {
      const diff = expiration - Date.now();
      setRemainingMs(Math.max(0, diff));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiration]);

  // Sync with backend on gridId change
  useEffect(() => {
    if (gridId) {
      syncCooldowns(gridId);
    }
  }, [gridId]);

  const isCooldownActive = remainingMs > 0;

  return {
    loading,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    formattedTime: formatRemainingTime(remainingMs),
    isExpired: !isCooldownActive,
    isCooldownActive,
    sync: () => gridId ? syncCooldowns(gridId) : Promise.resolve(),
  };
}
