import React, { useState, useEffect, useCallback } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  ImageSourcePropType,
  Platform,
} from "react-native";

import SearchBar from "../../components/HomePage/SearchBar";
import Colors from "@/constants/Colors";
import { API_URL, fetchData, refreshAccessToken } from "@/utils/apiHelper";
import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "..";
import FetchableImage from "@/components/FetchableImage";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useConnectivity } from "@/context/ConnectivityProvider";
import { fetchRoutesOfflineCapable } from "@/utils/offlineApi";
import OfflineBanner from "@/components/OfflineBanner";
import { useAutoSync } from "@/hooks/useAutoSync";

export const tagIcon = (name: string): ImageSourcePropType => {
  const key = name.trim();

  const tagIcons: { [key: string]: ImageSourcePropType } = {
    // Base icons
    Water: require("../../assets/tags-icons/Water.png"),
    Sunny: require("../../assets/tags-icons/Sunny.png"),
    Elevation: require("../../assets/tags-icons/Elevation.png"),

    // Backend tag names mapped to existing icons
    "Nature": require("../../assets/tags-icons/Elevation.png"),
    "Shadow": require("../../assets/tags-icons/Sunny.png"),
    "No Pollution": require("../../assets/tags-icons/Undefined.png"),
  };

  return tagIcons[key] || require("../../assets/tags-icons/Undefined.png");
};

export type RouteItem = {
  id: number;
  title: string;
  distance: string;
  photos: string[];
  estimated_time: string;
  average_rating: string;
  user: {
    id: string;
    username: string;
    photo: string;
  };
  tags: string[];
};

type ExplorePageProps = StackScreenProps<RootStackParamList, "Explore">;

const ExplorePage: React.FC<ExplorePageProps> = ({ navigation }) => {
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState<boolean>(false);
  const theme = useColorScheme() || "light";
  const { isConnected, isInternetReachable } = useConnectivity();
  
  // Auto-sync when connectivity is restored
  useAutoSync();

  useEffect(() => {
    const fetchAccessToken = async () => {
      let token = await SecureStore.getItemAsync("accessToken");
      if (!token) {
        token = await refreshAccessToken();
      }
      setAccessToken(token);
    };

    const fetchRoutes = async () => {
      try {
        const isOnline = isConnected && isInternetReachable;
        const result = await fetchRoutesOfflineCapable(isOnline);
        setRoutes(result.data);
        setFromCache(result.fromCache);
        setError(null);
      } catch (error: any) {
        console.error("Error fetching routes:", error);
        setError("Could not load routes. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchAccessToken();
    fetchRoutes();
  }, [isConnected, isInternetReachable]);

  const formatEstimatedTime = (timeString: string | null | undefined) => {
    if (!timeString) {
      return 'N/A';
    }
    
    const [hours, minutes, seconds] = timeString.split(":").map(Number);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  const renderRouteItem = ({ item }: { item: RouteItem }) => (
    <TouchableOpacity
      style={[
        routeStyling.routeCard,
        { backgroundColor: theme === "dark" ? "#1c1c1e" : "#fff" },
      ]}
      onPress={() => navigation.navigate("RouteView", { routeData: item })}
      activeOpacity={0.7}
    >
      {/* Header with creator info */}
      <View style={routeStyling.cardHeader}>
        <View style={routeStyling.creatorInfo}>
          <FetchableImage
            imageUrl={item.user.photo}
            defaultImage={require("../../assets/default-user.png")}
            style={routeStyling.creatorAvatar}
          />
          <View>
            <Text style={[routeStyling.creatorName, { color: Colors[theme].text }]}>
              {item.user.username}
            </Text>
            <Text style={[routeStyling.creatorLabel, { color: Colors[theme].text, opacity: 0.6 }]}>
              Route Creator
            </Text>
          </View>
        </View>
        <View style={[routeStyling.ratingBadge, { backgroundColor: Colors[theme].primary }]}>
          <Ionicons name="star" size={16} color={Colors[theme].buttonText} />
          <Text style={[routeStyling.ratingValue, { color: Colors[theme].buttonText }]}>
            {item.average_rating || "N/A"}
          </Text>
        </View>
      </View>

      {/* Route title */}
      <Text style={[routeStyling.routeTitle, { color: Colors[theme].text }]}>
        {item.title?.trim() || "Unnamed Route"}
      </Text>

      {/* Stats row */}
      <View style={routeStyling.statsRow}>
        <View style={routeStyling.statItem}>
          <Ionicons name="walk-outline" size={18} color={Colors[theme].primary} />
          <Text style={[routeStyling.statText, { color: Colors[theme].text }]}>
            {item.distance} km
          </Text>
        </View>
        <View style={routeStyling.statItem}>
          <Ionicons name="time-outline" size={18} color={Colors[theme].primary} />
          <Text style={[routeStyling.statText, { color: Colors[theme].text }]}>
            {formatEstimatedTime(item.estimated_time)}
          </Text>
        </View>
      </View>

      {/* Tags */}
      {item.tags.length > 0 && (
        <View style={routeStyling.tagsContainer}>
          {item.tags.slice(0, 4).map((tag, index) => (
            <View 
              key={index} 
              style={[routeStyling.modernTag, { backgroundColor: Colors[theme].primary + '20' }]}
            >
              <Image
                source={tagIcon(tag)}
                style={routeStyling.tagIconSmall}
              />
              <Text style={[routeStyling.tagLabel, { color: Colors[theme].primary }]}>
                {tag}
              </Text>
            </View>
          ))}
          {item.tags.length > 4 && (
            <Text style={[routeStyling.moreTagsText, { color: Colors[theme].text, opacity: 0.6 }]}>
              +{item.tags.length - 4}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={Colors[theme].primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: Colors[theme].background }]}
    >
      <OfflineBanner />
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: Colors[theme].text }]}>
          Explore Routes
        </Text>
        <Text style={[styles.headerSubtitle, { color: Colors[theme].text, opacity: 0.6 }]}>
          {fromCache ? 'Showing cached routes (Offline)' : 'Discover popular walking routes'}
        </Text>
      </View>
      <View style={styles.searchBarContainer}>
        <SearchBar navigation={navigation} />
      </View>
      <FlatList
        data={routes}
        renderItem={renderRouteItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  routeItem: {
    padding: 15,
    borderRadius: 8,
    marginVertical: 5,
    alignItems: "center",
  },
  routeText: {
    fontSize: 16,
    color: "white",
    fontWeight: "bold",
  },
  errorText: {
    color: "red",
    fontSize: 16,
    textAlign: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  searchBarContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
  },
});

const routeStyling = StyleSheet.create({
  routeCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 15,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  creatorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  creatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  creatorName: {
    fontSize: 15,
    fontWeight: "600",
  },
  creatorLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  routeTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 20,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: "500",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  modernTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  tagIconSmall: {
    width: 18,
    height: 18,
  },
  tagLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  moreTagsText: {
    fontSize: 12,
    fontWeight: "500",
  },
  // Old styles kept for compatibility
  routeItem: {
    padding: 15,
    borderRadius: 8,
    marginVertical: 4,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  titleText: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  userPicture: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 5,
  },
  usernameText: {
    marginLeft: 10,
    fontSize: 14,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  leftDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  ratingText: {
    fontSize: 14,
    textAlign: "right",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
  },
  tag: {
    fontSize: 12,
    color: "white",
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 5,
    marginBottom: 5,
  },
});

export default ExplorePage;
