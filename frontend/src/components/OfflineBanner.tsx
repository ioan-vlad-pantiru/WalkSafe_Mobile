import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useConnectivity } from '@/context/ConnectivityProvider';
import Colors from '@/constants/Colors';

interface OfflineBannerProps {
  message?: string;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({ message }) => {
  const { isConnected, isInternetReachable } = useConnectivity();
  const theme = useColorScheme() || 'light';

  if (isConnected && isInternetReachable) {
    return null;
  }

  return (
    <View style={[styles.banner, { backgroundColor: '#f39c12' }]}>
      <Ionicons name="cloud-offline" size={20} color="white" style={styles.icon} />
      <Text style={styles.text}>
        {message || 'Offline - Showing cached data'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OfflineBanner;
