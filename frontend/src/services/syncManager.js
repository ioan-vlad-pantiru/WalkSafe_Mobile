import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import {
  getOfflineQueue,
  removeFromOfflineQueue,
  incrementQueueRetryCount,
  getUnsyncedRoutes,
  saveRouteLocally,
  deleteRouteLocally,
  saveReviewLocally,
  deleteReviewLocally,
  updateLastSyncTime,
  getLastSyncTime,
  getLocalRoutes,
} from './database';
import { API_URL } from '../utils/apiHelper';

const MAX_RETRY_COUNT = 3;

/**
 * Sync local data with the server
 * This is the main synchronization function that runs when connectivity is restored
 */
export const syncWithServer = async () => {
  try {
    console.log('🔄 Starting sync with server...');

    const accessToken = await SecureStore.getItemAsync('accessToken');
    if (!accessToken) {
      console.log('❌ No access token available, skipping sync');
      return { success: false, error: 'Not authenticated' };
    }

    // Step 1: Process offline queue (operations done while offline)
    await processOfflineQueue(accessToken);

    // Step 2: Sync unsynced routes
    await syncUnsyncedRoutes(accessToken);

    // Step 3: Pull latest data from server
    await pullDataFromServer(accessToken);

    // Update last sync time
    await updateLastSyncTime();

    console.log('✅ Sync completed successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Sync failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Process all operations in the offline queue
 */
const processOfflineQueue = async (accessToken) => {
  try {
    const queue = await getOfflineQueue();
    console.log(`📋 Processing ${queue.length} queued operations...`);

    for (const operation of queue) {
      try {
        await processQueueOperation(operation, accessToken);
        await removeFromOfflineQueue(operation.id);
        console.log(`✅ Processed operation: ${operation.operation} ${operation.entity_type}`);
      } catch (error) {
        console.error(`❌ Failed to process operation ${operation.id}:`, error);
        
        // Increment retry count
        await incrementQueueRetryCount(operation.id);
        
        // Remove from queue if max retries reached
        if (operation.retry_count >= MAX_RETRY_COUNT - 1) {
          console.warn(`⚠️  Max retries reached for operation ${operation.id}, removing from queue`);
          await removeFromOfflineQueue(operation.id);
        }
      }
    }
  } catch (error) {
    console.error('Error processing offline queue:', error);
    throw error;
  }
};

/**
 * Process a single queued operation
 */
const processQueueOperation = async (operation, accessToken) => {
  const { operation: op, entity_type, entity_id, data } = operation;
  const headers = { Authorization: `Bearer ${accessToken}` };

  switch (entity_type) {
    case 'route':
      if (op === 'CREATE') {
        const response = await axios.post(`${API_URL}api/auth/route/`, data, { headers });
        // Update local route with server ID
        await saveRouteLocally({ 
          ...data, 
          server_id: response.data.id,
          name: data.title || data.name, // Backend uses 'title', DB uses 'name'
        }, true);
      } else if (op === 'UPDATE') {
        await axios.put(`${API_URL}api/auth/route/${entity_id}/`, data, { headers });
        await saveRouteLocally({ 
          ...data, 
          server_id: entity_id,
          name: data.title || data.name, // Backend uses 'title', DB uses 'name'
        }, true);
      } else if (op === 'DELETE') {
        await axios.delete(`${API_URL}api/auth/route/${entity_id}/`, { headers });
        // Permanently delete from local DB
        await deleteRouteLocally(entity_id, true);
      }
      break;

    case 'review':
      if (op === 'CREATE') {
        const response = await axios.post(`${API_URL}api/auth/review/`, data, { headers });
        await saveReviewLocally({ ...data, server_id: response.data.id }, true);
      } else if (op === 'UPDATE') {
        await axios.put(`${API_URL}api/auth/review/${entity_id}/`, data, { headers });
        await saveReviewLocally({ ...data, server_id: entity_id }, true);
      } else if (op === 'DELETE') {
        await axios.delete(`${API_URL}api/auth/review/${entity_id}/`, { headers });
        await deleteReviewLocally(entity_id, true);
      }
      break;

    default:
      console.warn(`Unknown entity type: ${entity_type}`);
  }
};

/**
 * Sync routes that were created/modified locally but not yet synced
 */
const syncUnsyncedRoutes = async (accessToken) => {
  try {
    const unsyncedRoutes = await getUnsyncedRoutes();
    console.log(`📤 Syncing ${unsyncedRoutes.length} unsynced routes...`);

    for (const route of unsyncedRoutes) {
      try {
        if (route.deleted) {
          // Delete on server if it has a server_id
          if (route.server_id) {
            await axios.delete(`${API_URL}api/auth/route/${route.server_id}/`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
          }
          // Remove from local DB
          await deleteRouteLocally(route.id);
        } else if (route.server_id) {
          // Update existing route on server
          await axios.put(`${API_URL}api/auth/route/${route.server_id}/`, route, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          await saveRouteLocally({ ...route, synced: true }, true);
        } else {
          // Create new route on server
          const response = await axios.post(`${API_URL}api/auth/route/`, route, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          await saveRouteLocally({ ...route, server_id: response.data.id }, true);
        }
      } catch (error) {
        console.error(`Failed to sync route ${route.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error syncing unsynced routes:', error);
    throw error;
  }
};

/**
 * Pull latest data from server and update local database
 */
const pullDataFromServer = async (accessToken) => {
  try {
    console.log('📥 Pulling latest data from server...');

    // Get last sync time to fetch only updated data
    const lastSync = await getLastSyncTime();
    const params = lastSync ? { updated_since: lastSync } : {};

    // Fetch public routes
    const routesResponse = await axios.get(`${API_URL}api/auth/routes/public/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params,
    });

    // Save routes to local DB
    const routes = routesResponse.data.results || routesResponse.data;
    for (const route of routes) {
      await saveRouteLocally({ 
        ...route, 
        server_id: route.id,
        name: route.title || route.name, // Backend uses 'title', DB uses 'name'
      }, true);
    }

    console.log(`✅ Pulled ${routes.length} routes from server`);

    // Fetch user's own routes
    const myRoutesResponse = await axios.get(`${API_URL}api/auth/routes/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const myRoutes = myRoutesResponse.data.results || myRoutesResponse.data;
    for (const route of myRoutes) {
      await saveRouteLocally({ 
        ...route, 
        server_id: route.id,
        name: route.title || route.name, // Backend uses 'title', DB uses 'name'
      }, true);
    }

    console.log(`✅ Pulled ${myRoutes.length} user routes from server`);
  } catch (error) {
    console.error('Error pulling data from server:', error);
    // Don't throw - partial sync is better than no sync
  }
};

/**
 * Check if sync is needed and perform it
 */
export const checkAndSync = async (isConnected) => {
  if (!isConnected) {
    console.log('📵 Offline - sync skipped');
    return { success: false, error: 'Offline' };
  }

  const lastSync = await getLastSyncTime();
  const now = new Date().getTime();
  const lastSyncTime = lastSync ? new Date(lastSync).getTime() : 0;
  const timeSinceLastSync = now - lastSyncTime;

  // Sync if more than 5 minutes since last sync
  const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

  if (!lastSync || timeSinceLastSync > SYNC_INTERVAL) {
    console.log('⏰ Sync interval reached, syncing...');
    return await syncWithServer();
  } else {
    console.log('⏱️  Sync not needed yet');
    return { success: true, skipped: true };
  }
};

/**
 * Force sync now (called manually by user or when app comes online)
 */
export const forceSyncNow = async () => {
  console.log('🔄 Force sync requested');
  return await syncWithServer();
};

/**
 * Get sync status information
 */
export const getSyncStatus = async () => {
  try {
    const queue = await getOfflineQueue();
    const unsyncedRoutes = await getUnsyncedRoutes();
    const lastSync = await getLastSyncTime();

    return {
      pendingOperations: queue.length,
      unsyncedRoutes: unsyncedRoutes.length,
      lastSyncTime: lastSync,
      needsSync: queue.length > 0 || unsyncedRoutes.length > 0,
    };
  } catch (error) {
    console.error('Error getting sync status:', error);
    return {
      pendingOperations: 0,
      unsyncedRoutes: 0,
      lastSyncTime: null,
      needsSync: false,
    };
  }
};
