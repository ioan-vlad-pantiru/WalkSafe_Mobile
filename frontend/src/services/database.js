import * as SQLite from 'expo-sqlite';

let db = null;

/**
 * Initialize the SQLite database and create tables
 */
export const initDatabase = async () => {
  try {
    db = await SQLite.openDatabaseAsync('walksafe.db');
    
    // Create routes table with all backend fields
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY,
        server_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        distance REAL,
        estimated_time TEXT,
        maximum_elevation_degree REAL,
        route_data TEXT,
        tags TEXT,
        visibility TEXT DEFAULT 'private',
        created_at TEXT,
        updated_at TEXT,
        user_id INTEGER,
        user_data TEXT,
        synced INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0
      );
    `);

    // Migrations: Add missing columns if they don't exist
    const routesMigrations = [
      'ALTER TABLE routes ADD COLUMN user_data TEXT;',
      'ALTER TABLE routes ADD COLUMN estimated_time TEXT;',
      'ALTER TABLE routes ADD COLUMN maximum_elevation_degree REAL;',
      'ALTER TABLE routes ADD COLUMN route_data TEXT;',
      'ALTER TABLE routes ADD COLUMN visibility TEXT DEFAULT "private";'
    ];

    for (const migration of routesMigrations) {
      try {
        await db.execAsync(migration);
      } catch (error) {
        // Column already exists, ignore
        if (!error.message.includes('duplicate column name')) {
          // Ignore other expected errors
        }
      }
    }

    // Create reviews table with all backend fields
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY,
        server_id INTEGER,
        route_id INTEGER,
        user_id INTEGER,
        user_data TEXT,
        rating INTEGER,
        description TEXT,
        tags TEXT,
        photos TEXT,
        created_at TEXT,
        synced INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0
      );
    `);

    // Migrations: Add missing columns to reviews if they don't exist
    const reviewsMigrations = [
      'ALTER TABLE reviews ADD COLUMN user_data TEXT;',
      'ALTER TABLE reviews ADD COLUMN description TEXT;',
      'ALTER TABLE reviews ADD COLUMN tags TEXT;',
      'ALTER TABLE reviews ADD COLUMN photos TEXT;',
      'ALTER TABLE reviews RENAME COLUMN comment TO description;'
    ];

    for (const migration of reviewsMigrations) {
      try {
        await db.execAsync(migration);
      } catch (error) {
        // Column already exists or rename not possible, ignore
      }
    }

    // Create tags table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY,
        server_id INTEGER,
        name TEXT NOT NULL UNIQUE,
        synced INTEGER DEFAULT 0
      );
    `);

    // Create offline queue table for pending operations
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0
      );
    `);

    // Create sync metadata table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

/**
 * Get the database instance
 */
export const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
};

// ============= ROUTES CRUD =============

/**
 * Save or update a route locally
 */
export const saveRouteLocally = async (route, synced = false) => {
  const db = getDatabase();
  const {
    id,
    server_id,
    name,
    description,
    distance,
    duration,
    difficulty,
    start_point,
    end_point,
    waypoints,
    tags,
    created_at,
    updated_at,
    user_id,
    user,
    is_public,
  } = route;

  try {
    const existingRoute = server_id 
      ? await db.getFirstAsync('SELECT * FROM routes WHERE server_id = ?', [server_id])
      : await db.getFirstAsync('SELECT * FROM routes WHERE id = ?', [id]);

    if (existingRoute) {
      // Update existing route
      await db.runAsync(
        `UPDATE routes SET 
          name = ?, description = ?, distance = ?, estimated_time = ?,
          maximum_elevation_degree = ?, route_data = ?, tags = ?, visibility = ?,
          updated_at = ?, user_id = ?, user_data = ?, synced = ?, server_id = ?
        WHERE ${server_id ? 'server_id' : 'id'} = ?`,
        [
          name,
          description || '',
          distance || 0,
          route.estimated_time || null,
          route.maximum_elevation_degree || null,
          JSON.stringify(route.route || route.waypoints || []),
          JSON.stringify(tags || []),
          route.visibility || 'private',
          updated_at || new Date().toISOString(),
          user_id || (user ? user.id : null),
          JSON.stringify(user || null),
          synced ? 1 : 0,
          server_id || null,
          server_id || id,
        ]
      );
      return existingRoute.id;
    } else {
      // Insert new route
      const result = await db.runAsync(
        `INSERT INTO routes (
          server_id, name, description, distance, estimated_time, 
          maximum_elevation_degree, route_data, tags, visibility,
          created_at, updated_at, user_id, user_data, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          server_id || null,
          name,
          description || '',
          distance || 0,
          route.estimated_time || null,
          route.maximum_elevation_degree || null,
          JSON.stringify(route.route || route.waypoints || []),
          JSON.stringify(tags || []),
          route.visibility || 'private',
          created_at || new Date().toISOString(),
          updated_at || new Date().toISOString(),
          user_id || (user ? user.id : null),
          JSON.stringify(user || null),
          synced ? 1 : 0,
        ]
      );
      return result.lastInsertRowId;
    }
  } catch (error) {
    console.error('Error saving route locally:', error);
    throw error;
  }
};

/**
 * Get all routes from local database
 * @param {Object} filters - Optional filters { publicOnly: boolean, userId: number }
 */
export const getLocalRoutes = async (filters = {}) => {
  const db = getDatabase();
  try {
    let query = 'SELECT * FROM routes WHERE deleted = 0';
    const params = [];

    if (filters.publicOnly) {
      query += ' AND visibility = ?';
      params.push('public');
    }

    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    query += ' ORDER BY created_at DESC';

    const routes = await db.getAllAsync(query, params);
    return routes.map(parseRoute);
  } catch (error) {
    console.error('Error getting local routes:', error);
    throw error;
  }
};

/**
 * Get a single route by ID
 */
export const getLocalRouteById = async (id, useServerId = false) => {
  const db = getDatabase();
  try {
    const route = useServerId
      ? await db.getFirstAsync('SELECT * FROM routes WHERE server_id = ? AND deleted = 0', [id])
      : await db.getFirstAsync('SELECT * FROM routes WHERE id = ? AND deleted = 0', [id]);
    return route ? parseRoute(route) : null;
  } catch (error) {
    console.error('Error getting local route:', error);
    throw error;
  }
};

/**
 * Delete a route locally (soft delete)
 */
export const deleteRouteLocally = async (id, useServerId = false) => {
  const db = getDatabase();
  try {
    await db.runAsync(
      `UPDATE routes SET deleted = 1, synced = 0 WHERE ${useServerId ? 'server_id' : 'id'} = ?`,
      [id]
    );
  } catch (error) {
    console.error('Error deleting route locally:', error);
    throw error;
  }
};

/**
 * Get unsynced routes
 */
export const getUnsyncedRoutes = async () => {
  const db = getDatabase();
  try {
    const routes = await db.getAllAsync('SELECT * FROM routes WHERE synced = 0');
    return routes.map(parseRoute);
  } catch (error) {
    console.error('Error getting unsynced routes:', error);
    throw error;
  }
};

// ============= REVIEWS CRUD =============

/**
 * Save or update a review locally
 */
export const saveReviewLocally = async (review, synced = false) => {
  const db = getDatabase();
  const { 
    id, 
    server_id, 
    route_id, 
    user_id, 
    user,
    rating, 
    description, 
    tags,
    photos,
    created_at 
  } = review;

  try {
    const existingReview = server_id
      ? await db.getFirstAsync('SELECT * FROM reviews WHERE server_id = ?', [server_id])
      : await db.getFirstAsync('SELECT * FROM reviews WHERE id = ?', [id]);

    if (existingReview) {
      await db.runAsync(
        `UPDATE reviews SET 
          rating = ?, description = ?, tags = ?, photos = ?,
          user_data = ?, synced = ?, server_id = ? 
        WHERE id = ?`,
        [
          rating, 
          description || '', 
          JSON.stringify(tags || []),
          JSON.stringify(photos || []),
          JSON.stringify(user || null),
          synced ? 1 : 0, 
          server_id || null, 
          existingReview.id
        ]
      );
      return existingReview.id;
    } else {
      const result = await db.runAsync(
        `INSERT INTO reviews (
          server_id, route_id, user_id, user_data, rating, 
          description, tags, photos, created_at, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          server_id || null, 
          route_id, 
          user_id || (user ? user.id : null),
          JSON.stringify(user || null),
          rating, 
          description || '', 
          JSON.stringify(tags || []),
          JSON.stringify(photos || []),
          created_at || new Date().toISOString(), 
          synced ? 1 : 0
        ]
      );
      return result.lastInsertRowId;
    }
  } catch (error) {
    console.error('Error saving review locally:', error);
    throw error;
  }
};

/**
 * Get reviews for a route
 */
export const getLocalReviewsByRouteId = async (routeId) => {
  const db = getDatabase();
  try {
    const reviews = await db.getAllAsync(
      'SELECT * FROM reviews WHERE route_id = ? AND deleted = 0',
      [routeId]
    );
    return reviews.map(parseReview);
  } catch (error) {
    console.error('Error getting local reviews:', error);
    throw error;
  }
};

/**
 * Delete a review locally
 */
export const deleteReviewLocally = async (id, useServerId = false) => {
  const db = getDatabase();
  try {
    await db.runAsync(
      `UPDATE reviews SET deleted = 1, synced = 0 WHERE ${useServerId ? 'server_id' : 'id'} = ?`,
      [id]
    );
  } catch (error) {
    console.error('Error deleting review locally:', error);
    throw error;
  }
};

// ============= OFFLINE QUEUE =============

/**
 * Add an operation to the offline queue
 */
export const addToOfflineQueue = async (operation, entityType, entityId, data) => {
  const db = getDatabase();
  try {
    await db.runAsync(
      `INSERT INTO offline_queue (operation, entity_type, entity_id, data, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [operation, entityType, entityId, JSON.stringify(data), new Date().toISOString()]
    );
  } catch (error) {
    console.error('Error adding to offline queue:', error);
    throw error;
  }
};

/**
 * Get all pending operations from the queue
 */
export const getOfflineQueue = async () => {
  const db = getDatabase();
  try {
    const operations = await db.getAllAsync(
      'SELECT * FROM offline_queue ORDER BY created_at ASC'
    );
    return operations.map(op => ({
      ...op,
      data: JSON.parse(op.data),
    }));
  } catch (error) {
    console.error('Error getting offline queue:', error);
    throw error;
  }
};

/**
 * Remove an operation from the queue after successful sync
 */
export const removeFromOfflineQueue = async (id) => {
  const db = getDatabase();
  try {
    await db.runAsync('DELETE FROM offline_queue WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error removing from offline queue:', error);
    throw error;
  }
};

/**
 * Increment retry count for a failed operation
 */
export const incrementQueueRetryCount = async (id) => {
  const db = getDatabase();
  try {
    await db.runAsync('UPDATE offline_queue SET retry_count = retry_count + 1 WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error incrementing retry count:', error);
    throw error;
  }
};

/**
 * Clear the entire queue (use with caution)
 */
export const clearOfflineQueue = async () => {
  const db = getDatabase();
  try {
    await db.runAsync('DELETE FROM offline_queue');
  } catch (error) {
    console.error('Error clearing offline queue:', error);
    throw error;
  }
};

// ============= SYNC METADATA =============

/**
 * Get last sync timestamp
 */
export const getLastSyncTime = async (key = 'last_sync') => {
  const db = getDatabase();
  try {
    const result = await db.getFirstAsync('SELECT value FROM sync_metadata WHERE key = ?', [key]);
    return result ? result.value : null;
  } catch (error) {
    console.error('Error getting last sync time:', error);
    return null;
  }
};

/**
 * Update last sync timestamp
 */
export const updateLastSyncTime = async (key = 'last_sync') => {
  const db = getDatabase();
  const now = new Date().toISOString();
  try {
    const existing = await db.getFirstAsync('SELECT * FROM sync_metadata WHERE key = ?', [key]);
    if (existing) {
      await db.runAsync('UPDATE sync_metadata SET value = ?, updated_at = ? WHERE key = ?', [
        now,
        now,
        key,
      ]);
    } else {
      await db.runAsync('INSERT INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)', [
        key,
        now,
        now,
      ]);
    }
  } catch (error) {
    console.error('Error updating last sync time:', error);
    throw error;
  }
};

// ============= HELPER FUNCTIONS =============

/**
 * Parse a route from the database (convert JSON strings back to objects)
 */
const parseRoute = (route) => {
  return {
    id: route.server_id || route.id,
    title: route.name,
    description: route.description,
    distance: route.distance,
    estimated_time: route.estimated_time,
    maximum_elevation_degree: route.maximum_elevation_degree,
    route: route.route_data ? JSON.parse(route.route_data) : [],
    tags: route.tags ? JSON.parse(route.tags) : [],
    visibility: route.visibility,
    created_at: route.created_at,
    updated_at: route.updated_at,
    user: route.user_data ? JSON.parse(route.user_data) : null,
    synced: Boolean(route.synced),
    deleted: Boolean(route.deleted),
  };
};

/**
 * Parse a review from the database (convert JSON strings back to objects)
 */
const parseReview = (review) => {
  return {
    id: review.server_id || review.id,
    route_id: review.route_id,
    user: review.user_data ? JSON.parse(review.user_data) : null,
    rating: review.rating,
    description: review.description,
    tags: review.tags ? JSON.parse(review.tags) : [],
    photos: review.photos ? JSON.parse(review.photos) : [],
    created_at: review.created_at,
    synced: Boolean(review.synced),
    deleted: Boolean(review.deleted),
  };
};

/**
 * Clear all data (for testing or logout)
 */
export const clearAllData = async () => {
  const db = getDatabase();
  try {
    await db.execAsync(`
      DELETE FROM routes;
      DELETE FROM reviews;
      DELETE FROM tags;
      DELETE FROM offline_queue;
      DELETE FROM sync_metadata;
    `);
    console.log('All local data cleared');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
};
