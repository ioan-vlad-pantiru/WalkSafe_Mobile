import React, { createContext, useContext, useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface ConnectivityContextType {
  isConnected: boolean;
  isInternetReachable: boolean;
  connectionType: string | null;
  // Debug mode functions
  forceOffline: () => void;
  forceOnline: () => void;
  resetToActual: () => void;
}

const ConnectivityContext = createContext<ConnectivityContextType>({
  isConnected: true,
  isInternetReachable: true,
  connectionType: null,
  forceOffline: () => {},
  forceOnline: () => {},
  resetToActual: () => {},
});

export const useConnectivity = () => {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity must be used within ConnectivityProvider');
  }
  return context;
};

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [actualIsConnected, setActualIsConnected] = useState(true);
  const [actualIsInternetReachable, setActualIsInternetReachable] = useState(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  
  // Debug mode state
  const [debugMode, setDebugMode] = useState<'actual' | 'offline' | 'online'>('actual');

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      setActualIsConnected(state.isConnected ?? true);
      setActualIsInternetReachable(state.isInternetReachable ?? true);
      setConnectionType(state.type);

      if (debugMode === 'actual') {
        if (state.isConnected && state.isInternetReachable) {
          console.log('📶 Network connected:', state.type);
        } else {
          console.log('📵 Network disconnected');
        }
      }
    });

    // Fetch initial state
    NetInfo.fetch().then(state => {
      setActualIsConnected(state.isConnected ?? true);
      setActualIsInternetReachable(state.isInternetReachable ?? true);
      setConnectionType(state.type);
    }).catch(error => {
      console.log('⚠️  NetInfo not available, assuming online');
      setActualIsConnected(true);
      setActualIsInternetReachable(true);
    });

    return () => {
      unsubscribe();
    };
  }, [debugMode]);

  // Debug mode functions
  const forceOffline = () => {
    setDebugMode('offline');
    console.log('🔧 DEBUG: Forced offline mode (Expo connection still active)');
  };

  const forceOnline = () => {
    setDebugMode('online');
    console.log('🔧 DEBUG: Forced online mode');
  };

  const resetToActual = () => {
    setDebugMode('actual');
    console.log('🔧 DEBUG: Reset to actual network state');
  };

  // Calculate effective connectivity based on debug mode
  const isConnected = debugMode === 'offline' ? false : (debugMode === 'online' ? true : actualIsConnected);
  const isInternetReachable = debugMode === 'offline' ? false : (debugMode === 'online' ? true : actualIsInternetReachable);

  return (
    <ConnectivityContext.Provider
      value={{
        isConnected,
        isInternetReachable,
        connectionType,
        forceOffline,
        forceOnline,
        resetToActual,
      }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
};
