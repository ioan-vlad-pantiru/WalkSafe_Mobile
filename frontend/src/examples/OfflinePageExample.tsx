/**
 * EXAMPLE: How to add offline support to a page
 * 
 * This file demonstrates how to convert an existing page to support offline functionality.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, FlatList } from 'react-native';
import { useConnectivity } from '@/context/ConnectivityProvider';
import { useAutoSync } from '@/hooks/useAutoSync';
import OfflineBanner from '@/components/OfflineBanner';
import {
  fetchRoutesOfflineCapable,
  createRouteOfflineCapable,
  updateRouteOfflineCapable,
  deleteRouteOfflineCapable,
} from '@/utils/offlineApi';

const ExampleOfflinePage = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  
  // 1. Get connectivity status
  const { isConnected, isInternetReachable } = useConnectivity();
  
  // 2. Enable auto-sync (automatically syncs when connectivity restored)
  useAutoSync();

  // 3. Fetch data with offline support
  useEffect(() => {
    const loadRoutes = async () => {
      const isOnline = isConnected && isInternetReachable;
      const result = await fetchRoutesOfflineCapable(isOnline);
      
      setRoutes(result.data);
      setFromCache(result.fromCache);
      setLoading(false);
    };

    loadRoutes();
  }, [isConnected, isInternetReachable]); // Re-fetch when connectivity changes

  // 4. Create with offline support
  const handleCreateRoute = async (routeData) => {
    const isOnline = isConnected && isInternetReachable;
    const userId = 1; // Get from user context
    
    const result = await createRouteOfflineCapable(routeData, isOnline, userId);
    
    if (result.offline) {
      // Show user: "Saved offline, will sync when online"
      alert(result.message);
    }
    
    // Add to local list
    setRoutes([...routes, result.data]);
  };

  // 5. Update with offline support
  const handleUpdateRoute = async (routeId, routeData) => {
    const isOnline = isConnected && isInternetReachable;
    
    const result = await updateRouteOfflineCapable(routeId, routeData, isOnline);
    
    if (result.offline) {
      alert(result.message);
    }
    
    // Update local list
    setRoutes(routes.map(r => r.id === routeId ? result.data : r));
  };

  // 6. Delete with offline support
  const handleDeleteRoute = async (routeId) => {
    const isOnline = isConnected && isInternetReachable;
    
    const result = await deleteRouteOfflineCapable(routeId, isOnline);
    
    if (result.offline) {
      alert(result.message);
    }
    
    // Remove from local list
    setRoutes(routes.filter(r => r.id !== routeId));
  };

  if (loading) {
    return <ActivityIndicator />;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* 7. Add offline banner */}
      <OfflineBanner />
      
      {/* 8. Show cache indicator in UI */}
      <Text>
        {fromCache ? 'Showing cached data (Offline)' : 'Live data'}
      </Text>
      
      <FlatList
        data={routes}
        renderItem={({ item }) => (
          <View>
            <Text>{item.name}</Text>
            {/* Action buttons use offline-capable handlers */}
            <Text onPress={() => handleUpdateRoute(item.id, { ...item, name: 'Updated' })}>
              Edit
            </Text>
            <Text onPress={() => handleDeleteRoute(item.id)}>
              Delete
            </Text>
          </View>
        )}
        keyExtractor={item => item.id.toString()}
      />
    </View>
  );
};

/**
 * STEP-BY-STEP CHECKLIST for adding offline support to a page:
 * 
 * ✅ 1. Import useConnectivity hook
 * ✅ 2. Import useAutoSync hook
 * ✅ 3. Import OfflineBanner component
 * ✅ 4. Import offline API functions (fetchRoutesOfflineCapable, etc.)
 * ✅ 5. Get connectivity status: const { isConnected, isInternetReachable } = useConnectivity()
 * ✅ 6. Enable auto-sync: useAutoSync()
 * ✅ 7. Add OfflineBanner to JSX
 * ✅ 8. Replace API calls with offline-capable versions
 * ✅ 9. Pass isOnline to all offline API functions
 * ✅ 10. Handle result.offline flag to show user feedback
 * ✅ 11. Add dependency on connectivity to useEffect
 * ✅ 12. Show cache indicator in UI when fromCache is true
 */

export default ExampleOfflinePage;
