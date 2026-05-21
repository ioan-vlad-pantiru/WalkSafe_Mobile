import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import {
  saveRouteLocally,
  getLocalRoutes,
  getLocalRouteById,
  deleteRouteLocally,
  saveReviewLocally,
  getLocalReviewsByRouteId,
  deleteReviewLocally,
  addToOfflineQueue,
} from '../services/database';
import { API_URL } from './apiHelper';

/**
 * Offline-capable CRUD operations for routes
 */

/**
 * Fetch all routes - returns local data if offline
 */
export const fetchRoutesOfflineCapable = async (isConnected) => {
  try {
    if (isConnected) {
      // Online: fetch from server and cache locally
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const response = await axios.get(`${API_URL}api/auth/routes/public/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const routes = response.data.results || response.data;
      
      // Cache all routes locally (map backend fields to local DB schema)
      for (const route of routes) {
        await saveRouteLocally({ 
          ...route, 
          server_id: route.id,
          name: route.title || route.name, // Backend uses 'title', DB uses 'name'
        }, true);
      }

      return { data: routes, fromCache: false };
    } else {
      // Offline: return cached PUBLIC routes only
      const localRoutes = await getLocalRoutes({ publicOnly: true });
      return { data: localRoutes, fromCache: true };
    }
  } catch (error) {
    // On error, fall back to local PUBLIC data only
    console.log('Failed to fetch from server, using cached data:', error.message);
    const localRoutes = await getLocalRoutes({ publicOnly: true });
    return { data: localRoutes, fromCache: true, error: error.message };
  }
};

/**
 * Fetch user's routes - returns local data if offline
 */
export const fetchMyRoutesOfflineCapable = async (isConnected) => {
  try {
    if (isConnected) {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const response = await axios.get(`${API_URL}api/auth/routes/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const routes = response.data.results || response.data;
      
      // Cache routes locally (map backend fields to local DB schema)
      for (const route of routes) {
        await saveRouteLocally({ 
          ...route, 
          server_id: route.id,
          name: route.title || route.name, // Backend uses 'title', DB uses 'name'
        }, true);
      }

      return { data: routes, fromCache: false };
    } else {
      // Return local routes (filter by user_id if needed)
      const localRoutes = await getLocalRoutes();
      return { data: localRoutes, fromCache: true };
    }
  } catch (error) {
    console.log('Failed to fetch user routes, using cached data:', error.message);
    const localRoutes = await getLocalRoutes();
    return { data: localRoutes, fromCache: true, error: error.message };
  }
};

/**
 * Fetch a single route by ID
 */
export const fetchRouteByIdOfflineCapable = async (routeId, isConnected) => {
  try {
    if (isConnected) {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const response = await axios.get(`${API_URL}api/auth/route/${routeId}/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const route = response.data;
      await saveRouteLocally({ 
        ...route, 
        server_id: route.id,
        name: route.title || route.name, // Backend uses 'title', DB uses 'name'
      }, true);

      return { data: route, fromCache: false };
    } else {
      const localRoute = await getLocalRouteById(routeId, true);
      return { data: localRoute, fromCache: true };
    }
  } catch (error) {
    console.log('Failed to fetch route, using cached data:', error.message);
    const localRoute = await getLocalRouteById(routeId, true);
    return { data: localRoute, fromCache: true, error: error.message };
  }
};

/**
 * Create a new route - saves locally if offline
 */
export const createRouteOfflineCapable = async (routeData, isConnected, userId) => {
  try {
    if (isConnected) {
      // Online: send to server
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const response = await axios.post(`${API_URL}api/auth/route/`, routeData, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Cache the created route
      const route = response.data;
      await saveRouteLocally({ 
        ...route, 
        server_id: route.id, 
        user_id: userId,
        name: route.title || route.name, // Backend uses 'title', DB uses 'name'
      }, true);

      return { data: route, offline: false };
    } else {
      // Offline: save locally and queue for sync
      const localId = await saveRouteLocally(
        {
          ...routeData,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        false
      );

      // Add to offline queue
      await addToOfflineQueue('CREATE', 'route', null, routeData);

      return {
        data: { id: localId, ...routeData },
        offline: true,
        message: 'Route saved offline. Will sync when online.',
      };
    }
  } catch (error) {
    console.error('Failed to create route online, saving offline:', error);
    
    // Fall back to offline mode
    const localId = await saveRouteLocally(
      {
        ...routeData,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      false
    );

    await addToOfflineQueue('CREATE', 'route', null, routeData);

    return {
      data: { id: localId, ...routeData },
      offline: true,
      message: 'Route saved offline. Will sync when online.',
      error: error.message,
    };
  }
};

/**
        ...route, 
        server_id: route.id,
        name: route.title || route.name, // Backend uses 'title', DB uses 'name'
     
 * Update an existing route - saves locally if offline
 */
export const updateRouteOfflineCapable = async (routeId, routeData, isConnected) => {
  try {
    if (isConnected) {
      // Online: update on server
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const response = await axios.put(`${API_URL}api/auth/route/${routeId}/`, routeData, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const route = response.data;
      await saveRouteLocally({ ...route, server_id: route.id }, true);

      return { data: route, offline: false };
    } else {
      // Offline: update locally and queue
      await saveRouteLocally({ ...routeData, server_id: routeId, updated_at: new Date().toISOString() }, false);
      await addToOfflineQueue('UPDATE', 'route', routeId, routeData);

      return {
        data: routeData,
        offline: true,
        message: 'Route updated offline. Will sync when online.',
      };
    }
  } catch (error) {
    console.error('Failed to update route online, saving offline:', error);
    
    await saveRouteLocally({ ...routeData, server_id: routeId, updated_at: new Date().toISOString() }, false);
    await addToOfflineQueue('UPDATE', 'route', routeId, routeData);

    return {
      data: routeData,
      offline: true,
      message: 'Route updated offline. Will sync when online.',
      error: error.message,
    };
  }
};

/**
 * Delete a route - marks as deleted if offline
 */
export const deleteRouteOfflineCapable = async (routeId, isConnected) => {
  try {
    if (isConnected) {
      // Online: delete on server
      const accessToken = await SecureStore.getItemAsync('accessToken');
      await axios.delete(`${API_URL}api/auth/route/${routeId}/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Remove from local DB
      await deleteRouteLocally(routeId, true);

      return { success: true, offline: false };
    } else {
      // Offline: mark as deleted locally and queue
      await deleteRouteLocally(routeId, true);
      await addToOfflineQueue('DELETE', 'route', routeId, {});

      return {
        success: true,
        offline: true,
        message: 'Route deleted offline. Will sync when online.',
      };
    }
  } catch (error) {
    console.error('Failed to delete route online, marking offline:', error);
    
    await deleteRouteLocally(routeId, true);
    await addToOfflineQueue('DELETE', 'route', routeId, {});

    return {
      success: true,
      offline: true,
      message: 'Route deleted offline. Will sync when online.',
      error: error.message,
    };
  }
};

/**
 * Create a review - saves locally if offline
 */
export const createReviewOfflineCapable = async (reviewData, isConnected, userId) => {
  try {
    if (isConnected) {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const response = await axios.post(`${API_URL}api/auth/review/`, reviewData, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const review = response.data;
      await saveReviewLocally({ ...review, server_id: review.id, user_id: userId }, true);

      return { data: review, offline: false };
    } else {
      const localId = await saveReviewLocally(
        {
          ...reviewData,
          user_id: userId,
          created_at: new Date().toISOString(),
        },
        false
      );

      await addToOfflineQueue('CREATE', 'review', null, reviewData);

      return {
        data: { id: localId, ...reviewData },
        offline: true,
        message: 'Review saved offline. Will sync when online.',
      };
    }
  } catch (error) {
    console.error('Failed to create review online, saving offline:', error);
    
    const localId = await saveReviewLocally(
      {
        ...reviewData,
        user_id: userId,
        created_at: new Date().toISOString(),
      },
      false
    );

    await addToOfflineQueue('CREATE', 'review', null, reviewData);

    return {
      data: { id: localId, ...reviewData },
      offline: true,
      message: 'Review saved offline. Will sync when online.',
      error: error.message,
    };
  }
};

/**
 * Fetch reviews for a route
 */
export const fetchReviewsOfflineCapable = async (routeId, isConnected) => {
  try {
    if (isConnected) {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const response = await axios.get(`${API_URL}api/auth/route/${routeId}/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const reviews = response.data.results || response.data;
      
      // Cache reviews
      for (const review of reviews) {
        await saveReviewLocally({ ...review, server_id: review.id, route_id: routeId }, true);
      }

      return { data: reviews, fromCache: false };
    } else {
      const localReviews = await getLocalReviewsByRouteId(routeId);
      return { data: localReviews, fromCache: true };
    }
  } catch (error) {
    console.log('Failed to fetch reviews, using cached data:', error.message);
    const localReviews = await getLocalReviewsByRouteId(routeId);
    return { data: localReviews, fromCache: true, error: error.message };
  }
};

/**
 * Delete a review
 */
export const deleteReviewOfflineCapable = async (reviewId, isConnected) => {
  try {
    if (isConnected) {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      await axios.delete(`${API_URL}api/auth/review/${reviewId}/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      await deleteReviewLocally(reviewId, true);

      return { success: true, offline: false };
    } else {
      await deleteReviewLocally(reviewId, true);
      await addToOfflineQueue('DELETE', 'review', reviewId, {});

      return {
        success: true,
        offline: true,
        message: 'Review deleted offline. Will sync when online.',
      };
    }
  } catch (error) {
    console.error('Failed to delete review online, marking offline:', error);
    
    await deleteReviewLocally(reviewId, true);
    await addToOfflineQueue('DELETE', 'review', reviewId, {});

    return {
      success: true,
      offline: true,
      message: 'Review deleted offline. Will sync when online.',
      error: error.message,
    };
  }
};
