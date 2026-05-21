import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  FlatList,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useColorScheme } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Colors from "@/constants/Colors";
import { mapboxToken, fetchData, API_URL } from "@/utils/apiHelper";
import ProfilePictureHeader from "@/components/ProfilePictureHeader";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "..";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";
import {RouteItem as BaseRouteItem} from "@/app/pages/RoutesList";
import * as SecureStore from "expo-secure-store";

// Custom UUID generator to avoid crypto.getRandomValues error
const generateSessionToken = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

type SearchResult = {
  id: number;
  text: string;
  place_name: string;
  coordinates: { latitude: number; longitude: number } | null;
  distance?: number;
  mapbox_id?: string;
  feature_type?: string;
};

type RouteItem = BaseRouteItem & {
  name: string;
  created_at: string;
  title?: string;
  distance: number;
  tags: string[];
};

type TagType = {
  id: number;
  name: string;
}

type SearchPageNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Search"
>;

const SearchPage: React.FC = () => {
  const [query, setQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [recentRoutes, setRecentRoutes] = useState<RouteItem[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sessionToken, setSessionToken] = useState<string>(
    generateSessionToken()
  );
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const theme = useColorScheme() || "light";
  const navigation = useNavigation<SearchPageNavigationProp>();

  useEffect(() => {
    const getLocation = async (retries = 3) => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("Permission to access location was denied");
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        if (retries > 0) {
          console.warn(
            `Retrying to fetch location... Attempts left: ${retries}`
          );
          setTimeout(() => getLocation(retries - 1), 1000);
        } else {
          console.error("Failed to fetch user location after retries:", error);
        }
      }
    };

    getLocation();
  }, []);

  useEffect(() => {
    const getTags = async () => {
      try {
        const response = await fetchData(`${API_URL}api/tags/`);
        setAllTags(response);
      } catch (error) {
        console.error("Failed to fetch tags:", error);
      }
    };
    getTags();
  }, []);

  const handleTagPress = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  useEffect(() => {
    const fetchRecentRoutes = async () => {
      try {
        const data: RouteItem[] = await fetchData(`${API_URL}api/auth/routes/`);

        // Sort by creation date and limit to 5 most recent routes
        const sortedRoutes = data.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setRecentRoutes(sortedRoutes.slice(0, 5));
      } catch (error) {
        console.error("Error fetching recent routes:", error);
      }
    };
    fetchRecentRoutes();
  }, []);

  const fetchCoordinates = async (
    mapboxId: string
  ): Promise<SearchResult | null> => {
    try {
      const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}?session_token=${sessionToken}&access_token=${mapboxToken}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch location details from Searchbox API");
      }

      const data = await response.json();

      const feature = data.features?.[0];
      if (feature) {
        const { geometry, properties } = feature;
        return {
          id: properties.mapbox_id,
          text: properties.name || "Unnamed location",
          place_name:
            properties.full_address ||
            properties.place_formatted ||
            "Unknown address",
          coordinates: {
            latitude: geometry.coordinates[1],
            longitude: geometry.coordinates[0],
          },
        };
      }

      console.warn("No features found for the given mapbox_id:", mapboxId);
      return null;
    } catch (error) {
      console.error("Error fetching location details:", error);
      return null;
    }
  };

  const fetchSearchResults = async (query: string) => {
    if (!userLocation) {
      console.error("User location is not available for search.");
      return;
    }

    setIsLoading(true);

    try {
      const { latitude, longitude } = userLocation;
      const url = `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(
        query
      )}&language=en&proximity=${longitude},${latitude}&session_token=${sessionToken}&access_token=${mapboxToken}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch suggestions from Searchbox API");
      }

      const data = await response.json();

      const results =
        data.suggestions?.map((suggestion: any, index: number) => {
          const {
            name,
            full_address,
            id,
            mapbox_id,
            distance,
            feature_type,
          } = suggestion;
          return {
            id: id || `${name}-${index}`, // Ensure a unique key by combining text and index
            text: name || "Unnamed location",
            place_name: full_address || "Unknown address",
            coordinates: null,
            distance: distance
              ? (distance / 1000).toFixed(2).replace(/\.00$/, "")
              : undefined, // Convert meters to kilometers
            mapbox_id,
            feature_type,
          };
        }) || [];

      setSearchResults(results);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectLocation = async (location: SearchResult) => {
    if (!location.mapbox_id) {
      console.error("Missing mapbox_id for location");
      return;
    }

    // Check if it's a brand - fetch all brand locations
    if (location.feature_type === "brand") {
      await handleSelectBrand(location);
      return;
    }

    const detailedLocation = await fetchCoordinates(location.mapbox_id);

    if (detailedLocation && detailedLocation.coordinates) {
      navigation.navigate("Home", {
        startLocation: userLocation,
        selectedCoordinates: detailedLocation.coordinates,
        selectedPlaceName: detailedLocation.place_name,
        selectedTags: selectedTagIds,
      });
      setSessionToken(generateSessionToken());
    } else {
      console.error("Failed to retrieve detailed location data.");
    }
  };

  const handleSelectBrand = async (brand: SearchResult) => {
    try {
      setIsLoading(true);
      
      // Use the current search results to find all matching brand locations
      const brandResults = searchResults.filter((result) => 
        result.feature_type === "brand" && 
        result.text.toLowerCase() === brand.text.toLowerCase()
      );

      console.log(`Found ${brandResults.length} brand results for ${brand.text}`);

      if (brandResults.length === 0) {
        // Fallback: just navigate to the single selected brand location
        const detailedLocation = await fetchCoordinates(brand.mapbox_id!);
        if (detailedLocation && detailedLocation.coordinates) {
          navigation.navigate("Home", {
            startLocation: userLocation,
            selectedCoordinates: detailedLocation.coordinates,
            selectedPlaceName: brand.text,
            selectedTags: selectedTagIds,
          });
          setSessionToken(generateSessionToken());
        }
        return;
      }

      // Fetch coordinates for each brand location
      const brandLocationPromises = brandResults.map(async (result) => {
        if (!result.mapbox_id) return null;
        
        try {
          const location = await fetchCoordinates(result.mapbox_id);
          if (location && location.coordinates) {
            return {
              latitude: location.coordinates.latitude,
              longitude: location.coordinates.longitude,
              name: result.name || brand.text,
              address: result.place_formatted || location.place_name,
            };
          }
        } catch (error) {
          console.error(`Failed to fetch coordinates for ${result.mapbox_id}:`, error);
        }
        return null;
      });

      const brandLocationsResults = await Promise.all(brandLocationPromises);
      const brandLocations = brandLocationsResults.filter((loc): loc is {
        latitude: number;
        longitude: number;
        name: string;
        address?: string;
      } => loc !== null);

      console.log(`Successfully fetched ${brandLocations.length} brand locations`);

      if (brandLocations.length > 0) {
        // Navigate to map with all brand locations
        navigation.navigate("Home", {
          startLocation: userLocation,
          selectedCoordinates: brandLocations[0], // First location
          selectedPlaceName: `${brand.text} (${brandLocations.length} location${brandLocations.length > 1 ? 's' : ''})`,
          selectedTags: selectedTagIds,
          brandLocations: brandLocations, // Pass all brand locations
        });
        setSessionToken(generateSessionToken());
      } else {
        Alert.alert("No Locations", `Could not fetch coordinates for ${brand.text} locations.`);
      }
    } catch (error) {
      console.error("Error fetching brand locations:", error);
      Alert.alert("Error", "Failed to fetch brand locations. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRecentRoute = async (routeId: number) => {
    try {
      const accessToken = await SecureStore.getItemAsync("accessToken");
      if (!accessToken) {
        throw new Error("No access token found.");
      }
  
      const response = await fetch(`${API_URL}api/auth/route/${routeId}/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
  
      if (!response.ok) {
        throw new Error("Failed to fetch route details.");
      }
  
      const data = await response.json();
  
      // Convert lat and long to numbers
      const formattedRoute = data.route.map((point: any) => ({
        latitude: parseFloat(point.lat),
        longitude: parseFloat(point.long),
      }));
  
      console.log("Selected route details:", formattedRoute);
  
      // Pass numeric coordinates to the Home page
      navigation.navigate("Home", {
        startLocation: formattedRoute[0],
        selectedCoordinates: formattedRoute[formattedRoute.length - 1],
        selectedPlaceName: data.title,
        waypoints: formattedRoute,
      });
    } catch (error) {
      console.error("Error fetching route details:", error);
      Alert.alert("Error", "Could not load route details.");
    }
  };
  


  const goBack = () => {
    navigation.goBack();
  };

  const handleInputChange = (text: string) => {
    setQuery(text);

    if (!userLocation) {
      console.warn("Waiting for user location...");
      return;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (text.trim() !== "") {
      typingTimeoutRef.current = setTimeout(() => {
        fetchSearchResults(text);
      }, 500);
    } else {
      setSearchResults([]);
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: Colors[theme].background }]}
    >
      {/* Modern Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={26} color={Colors[theme].text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: Colors[theme].text }]}>
          Search Destination
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: theme === "dark" ? "#1c1c1e" : "#fff" }]}>
        <Ionicons name="search" size={20} color={Colors[theme].text} style={{ opacity: 0.5 }} />
        <TextInput
          style={[styles.input, { color: Colors[theme].text }]}
          placeholder="Where do you want to go?"
          placeholderTextColor={Colors[theme].text + "80"}
          value={query}
          onChangeText={handleInputChange}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(""); setSearchResults([]); }}>
            <Ionicons name="close-circle" size={20} color={Colors[theme].text} style={{ opacity: 0.5 }} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tags Section */}
      {allTags.length > 0 && (
        <View style={styles.tagsSection}>
          <Text style={[styles.sectionTitle, { color: Colors[theme].text, opacity: 0.6 }]}>
            FILTER BY TAGS
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsScrollContent}
          >
            {allTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.modernTagChip,
                    {
                      backgroundColor: isSelected
                        ? Colors[theme].primary
                        : theme === "dark" ? "#2c2c2e" : "#f2f2f7",
                    },
                  ]}
                  onPress={() => handleTagPress(tag.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.modernTagText,
                      { color: isSelected ? Colors[theme].buttonText : Colors[theme].text },
                    ]}
                  >
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {query.trim() === "" && recentRoutes.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={[styles.sectionTitle, { color: Colors[theme].text, opacity: 0.6 }]}>
            RECENT ROUTES
          </Text>
          <FlatList
            data={recentRoutes}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelectRecentRoute(Number(item.id))}
                style={[
                  styles.modernResultCard,
                  { backgroundColor: theme === "dark" ? "#1c1c1e" : "#fff" },
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: Colors[theme].primary + "20" }]}>
                  <Ionicons
                    name="time"
                    size={22}
                    color={Colors[theme].primary}
                  />
                </View>
                <View style={styles.resultContent}>
                  <Text
                    style={[
                      styles.modernResultTitle,
                      { color: Colors[theme].text },
                    ]}
                    numberOfLines={1}
                  >
                    {item.title?.trim()}
                  </Text>
                  <Text
                    style={[
                      styles.modernResultSubtitle,
                      { color: Colors[theme].text, opacity: 0.6 },
                    ]}
                  >
                    {item.distance ? `${item.distance} km` : "No distance"}
                  </Text>
                  {item.tags && item.tags.length > 0 && (
                    <View style={styles.inlineTags}>
                      {item.tags.slice(0, 3).map((tag, index) => (
                        <View
                          key={index}
                          style={[
                            styles.miniTag,
                            { backgroundColor: Colors[theme].primary + "20" },
                          ]}
                        >
                          <Text style={[styles.miniTagText, { color: Colors[theme].primary }]}>
                            {tag}
                          </Text>
                        </View>
                      ))}
                      {item.tags.length > 3 && (
                        <Text style={[styles.moreTagsText, { color: Colors[theme].text, opacity: 0.5 }]}>
                          +{item.tags.length - 3}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors[theme].text} style={{ opacity: 0.3 }} />
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[theme].primary} />
          <Text style={[styles.loadingText, { color: Colors[theme].text, opacity: 0.6 }]}>
            Searching...
          </Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.modernResultCard,
                { backgroundColor: theme === "dark" ? "#1c1c1e" : "#fff" },
              ]}
              onPress={() => handleSelectLocation(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: Colors[theme].primary + "20" }]}>
                <Ionicons
                  name={
                    item.feature_type === "brand"
                      ? "storefront"
                      : "location"
                  }
                  size={22}
                  color={Colors[theme].primary}
                />
              </View>
              <View style={styles.resultContent}>
                <Text
                  style={[styles.modernResultTitle, { color: Colors[theme].text }]}
                  numberOfLines={1}
                >
                  {item.text}
                </Text>
                <Text
                  style={[styles.modernResultSubtitle, { color: Colors[theme].text, opacity: 0.6 }]}
                  numberOfLines={1}
                >
                  {item.feature_type === "brand" ? "Brand" : item.place_name}
                </Text>
                {item.distance && (
                  <Text style={[styles.distanceBadge, { color: Colors[theme].primary }]}>
                    {item.distance} km away
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors[theme].text} style={{ opacity: 0.3 }} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            query && !searchResults.length ? (
              <View style={styles.emptyState}>
                <Ionicons name="search" size={64} color={Colors[theme].text} style={{ opacity: 0.2 }} />
                <Text style={[styles.emptyText, { color: Colors[theme].text, opacity: 0.5 }]}>
                  No results found
                </Text>
                <Text style={[styles.emptySubtext, { color: Colors[theme].text, opacity: 0.4 }]}>
                  Try searching for a different location
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingBottom: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 15,
    height: 50,
    borderRadius: 15,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  tagsSection: {
    marginBottom: 20,
  },
  recentSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    marginLeft: 20,
    marginBottom: 12,
  },
  tagsScrollContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  modernTagChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modernTagText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modernResultCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 15,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
  },
  modernResultTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  modernResultSubtitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  distanceBadge: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  inlineTags: {
    flexDirection: "row",
    marginTop: 8,
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
  },
  miniTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  miniTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  moreTagsText: {
    fontSize: 11,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  // Old styles for compatibility
  overlay: {
    position: "absolute",
    top: 15,
    left: 15,
    right: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 40,
    zIndex: 1,
    pointerEvents: "box-none",
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 10,
  },
  tagsContainer: {
    height: 40,
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  tagItem: {
    height:30,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
    marginRight: 10,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 14,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultIcon: {
    marginRight: 15,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  resultDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  resultDistance: {
    fontSize: 12,
    marginTop: 4,
  },
});


export default SearchPage;
