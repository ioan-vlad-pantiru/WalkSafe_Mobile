import { useEffect, useRef } from 'react';
import { useConnectivity } from '@/context/ConnectivityProvider';
import { syncWithServer } from '@/services/syncManager';

/**
 * Hook to automatically sync with server when connectivity is restored
 */
export const useAutoSync = () => {
  const { isConnected, isInternetReachable } = useConnectivity();
  const previouslyConnected = useRef(isConnected && isInternetReachable);

  useEffect(() => {
    const wasOffline = !previouslyConnected.current;
    const isNowOnline = isConnected && isInternetReachable;

    // If we were offline and are now online, trigger sync
    if (wasOffline && isNowOnline) {
      console.log('🔄 Connectivity restored, syncing...');
      syncWithServer().then(result => {
        if (result.success) {
          console.log('✅ Auto-sync completed');
        } else {
          console.log('❌ Auto-sync failed:', result.error);
        }
      });
    }

    previouslyConnected.current = isNowOnline;
  }, [isConnected, isInternetReachable]);
};
