import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useConnectivity } from '../context/ConnectivityProvider';

/**
 * Debug component to manually toggle offline mode for testing
 * Usage: Add <OfflineDebugToggle /> to any page during development
 */
export const OfflineDebugToggle: React.FC = () => {
  const { isConnected, forceOffline, forceOnline, resetToActual } = useConnectivity();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug Mode</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.button, styles.offlineButton]} 
          onPress={forceOffline}
        >
          <Text style={styles.buttonText}>Force Offline</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.onlineButton]} 
          onPress={forceOnline}
        >
          <Text style={styles.buttonText}>Force Online</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.resetButton]} 
          onPress={resetToActual}
        >
          <Text style={styles.buttonText}>Reset</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.status}>
        Status: {isConnected ? '🟢 Online' : '🔴 Offline'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    margin: 10,
    borderWidth: 2,
    borderColor: '#ff6b6b',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#ff6b6b',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  offlineButton: {
    backgroundColor: '#e74c3c',
  },
  onlineButton: {
    backgroundColor: '#27ae60',
  },
  resetButton: {
    backgroundColor: '#3498db',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  status: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
