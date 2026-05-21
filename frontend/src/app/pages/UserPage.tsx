import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Modal,
  TouchableWithoutFeedback,
  FlatList,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useColorScheme } from "react-native";
import { ThemedText } from "../../components/ThemedComponents/ThemedText";
import { ThemedView } from "../../components/ThemedComponents/ThemedView";
import Colors from "@/constants/Colors";
import { useUserContext } from "@/context/UserProvider";
import { API_URL, refreshAccessToken } from "@/utils/apiHelper";
import FetchableImage from "../../components/FetchableImage";
import * as SecureStore from "expo-secure-store";
import TabLink from "@/components/TabLink";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

type UserPageProps = {
  navigation: any;
};

type UserRoute = {
  id: number;
  title: string;
  visibility: string;
};

const UserPage: React.FC<UserPageProps> = ({ navigation }) => {
  const { userData } = useUserContext();
  const theme = useColorScheme() || "light";
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [enlargedPhotoUri, setEnlargedPhotoUri] = useState<string | null>(null);
  const [userRoutes, setUserRoutes] = useState<UserRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);

  const tabs = ["Statistics", "MyRoutes", "Achievements"];
  const flatListRef = useRef<FlatList>(null);


  useEffect(() => {
    const fetchAccessToken = async () => {
      try {
        let token = await SecureStore.getItemAsync("accessToken");
        if (!token) {
          token = await refreshAccessToken();
        }
        setAccessToken(token);
      } catch (error) {
        console.error("Error fetching access token:", error);
      }
    };

    fetchAccessToken();
  }, []);

  useEffect(() => {
    const fetchUserRoutes = async () => {
      try {
        setRoutesLoading(true);
        let token = await SecureStore.getItemAsync("accessToken");
        if (!token) {
          token = await refreshAccessToken();
        }

        const response = await fetch(`${API_URL}api/auth/routes/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch routes");
        }

        const data: UserRoute[] = await response.json();
        setUserRoutes(data);
        setRoutesError(null);
      } catch (error) {
        console.error("Error fetching user routes:", error);
        setRoutesError("Could not load routes.");
      } finally {
        setRoutesLoading(false);
      }
    };

    fetchUserRoutes();
  }, []);

  const handleTabPress = (index: number) => {
    setActiveTabIndex(index);
    flatListRef.current?.scrollToOffset({ offset: width * index, animated: true });
  };

  const handlePhotoPress = () => {
    setEnlargedPhotoUri(userData?.photo || null);
    setIsModalVisible(true);
  };

  const renderTabContent = (index: number) => {
    if (index === 0) {
      // Statistics Tab
      const stats = [
        {
          icon: "map-outline",
          label: "Total Routes",
          value: userData?.statistics?.routes || 0,
          color: Colors[theme].primary,
        },
        {
          icon: "thumbs-up-outline",
          label: "Upvotes",
          value: userData?.statistics?.upvotes || 0,
          color: Colors[theme].success,
        },
        {
          icon: "thumbs-down-outline",
          label: "Downvotes",
          value: userData?.statistics?.downvotes || 0,
          color: Colors[theme].error,
        },
        {
          icon: "star-outline",
          label: "Rating",
          value: userData?.statistics?.average_received_rating || "N/A",
          color: Colors[theme].warning,
        },
      ];

      return (
        <ScrollView 
          style={{ width }} 
          contentContainerStyle={styles.tabScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statsGrid}>
            {stats.map((stat, idx) => (
              <View
                key={idx}
                style={[
                  styles.statCard,
                  { backgroundColor: Colors[theme].surface },
                ]}
              >
                <View style={[styles.statIconContainer, { backgroundColor: stat.color + "20" }]}>
                  <Ionicons name={stat.icon as any} size={24} color={stat.color} />
                </View>
                <ThemedText style={styles.statValue}>{stat.value}</ThemedText>
                <ThemedText style={styles.statLabel}>{stat.label}</ThemedText>
              </View>
            ))}
          </View>
        </ScrollView>
      );
    }

    if (index === 1) {
      // My Routes Tab
      return (
        <ScrollView 
          style={{ width }} 
          contentContainerStyle={styles.tabScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {routesLoading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={Colors[theme].primary} />
              <ThemedText style={styles.loadingText}>Loading routes...</ThemedText>
            </View>
          ) : routesError ? (
            <View style={styles.centerContent}>
              <Ionicons name="alert-circle-outline" size={48} color={Colors[theme].error} />
              <ThemedText style={styles.errorText}>{routesError}</ThemedText>
            </View>
          ) : userRoutes.length > 0 ? (
            <View style={styles.routesList}>
              {userRoutes.map((route) => (
                <TouchableOpacity
                  key={route.id}
                  style={[styles.routeCard, { backgroundColor: Colors[theme].surface }]}
                  onPress={() => navigation.navigate("RouteView", { routeData: route })}
                >
                  <View style={styles.routeCardContent}>
                    <View style={styles.routeIconContainer}>
                      <Ionicons 
                        name="map" 
                        size={24} 
                        color={Colors[theme].primary} 
                      />
                    </View>
                    <View style={styles.routeInfo}>
                      <ThemedText style={styles.routeTitle}>{route.title}</ThemedText>
                      <View style={styles.routeMetaContainer}>
                        <View
                          style={[
                            styles.visibilityBadge,
                            {
                              backgroundColor:
                                route.visibility === "public"
                                  ? Colors[theme].success + "20"
                                  : Colors[theme].textLight + "20",
                            },
                          ]}
                        >
                          <Ionicons
                            name={route.visibility === "public" ? "globe-outline" : "lock-closed-outline"}
                            size={12}
                            color={
                              route.visibility === "public"
                                ? Colors[theme].success
                                : Colors[theme].textLight
                            }
                          />
                          <ThemedText
                            style={[
                              styles.visibilityText,
                              {
                                color:
                                  route.visibility === "public"
                                    ? Colors[theme].success
                                    : Colors[theme].textLight,
                              },
                            ]}
                          >
                            {route.visibility === "public" ? "Public" : "Private"}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors[theme].textLight} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.centerContent}>
              <Ionicons name="map-outline" size={64} color={Colors[theme].textLight} />
              <ThemedText style={styles.emptyText}>No routes yet</ThemedText>
              <ThemedText style={styles.emptySubtext}>
                Start exploring and create your first route!
              </ThemedText>
            </View>
          )}
        </ScrollView>
      );
    }

    if (index === 2) {
      // Achievements Tab
      return (
        <ScrollView 
          style={{ width }} 
          contentContainerStyle={styles.tabScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {userData?.achievements && userData.achievements.length > 0 ? (
            <View style={styles.achievementsList}>
              {userData.achievements.map((achievement, i) => {
                const progress = (achievement.currentStars / 3) * 100;
                return (
                  <View
                    key={i}
                    style={[
                      styles.achievementCard,
                      { backgroundColor: Colors[theme].surface },
                    ]}
                  >
                    <View style={styles.achievementHeader}>
                      <View
                        style={[
                          styles.achievementIconContainer,
                          { backgroundColor: Colors[theme].warning + "20" },
                        ]}
                      >
                        <Ionicons name="trophy" size={28} color={Colors[theme].warning} />
                      </View>
                      <View style={styles.achievementInfo}>
                        <ThemedText style={styles.achievementName}>{achievement.name}</ThemedText>
                        <ThemedText style={styles.achievementProgress}>
                          {achievement.currentStars}/3 stars
                        </ThemedText>
                      </View>
                    </View>

                    {/* Stars Display */}
                    <View style={styles.starsContainer}>
                      {[...Array(3)].map((_, starIndex) => (
                        <View key={starIndex} style={styles.starWrapper}>
                          <Ionicons
                            name={starIndex < achievement.currentStars ? "star" : "star-outline"}
                            size={32}
                            color={
                              starIndex < achievement.currentStars
                                ? Colors[theme].warning
                                : Colors[theme].border
                            }
                          />
                        </View>
                      ))}
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressBarContainer}>
                      <View
                        style={[
                          styles.progressBarBackground,
                          { backgroundColor: Colors[theme].border },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${progress}%`,
                              backgroundColor: Colors[theme].warning,
                            },
                          ]}
                        />
                      </View>
                      <ThemedText style={styles.progressText}>{Math.round(progress)}%</ThemedText>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.centerContent}>
              <Ionicons name="ribbon-outline" size={64} color={Colors[theme].textLight} />
              <ThemedText style={styles.emptyText}>No achievements yet</ThemedText>
              <ThemedText style={styles.emptySubtext}>
                Complete routes to earn achievements!
              </ThemedText>
            </View>
          )}
        </ScrollView>
      );
    }

    return null;
  };

  return (    
    <ThemedView style={styles.container}>
      {/* Profile Header with Solid Color Background */}
      <View style={styles.headerContainer}>
        <View
          style={[styles.headerBackground, { backgroundColor: Colors[theme].primary }]}
        >
          <SafeAreaView>
            <View style={styles.profileHeader}>
              <TouchableOpacity onPress={handlePhotoPress} style={styles.photoContainer}>
                <FetchableImage
                  imageUrl={userData?.photo || null}
                  defaultImage={require("../../assets/default-user.png")}
                  style={styles.userImage}
                  resizeMode="cover"
                />
                <View style={styles.editBadge}>
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <ThemedText style={styles.userName}>{userData?.username}</ThemedText>
              <ThemedText style={styles.userEmail}>{userData?.email}</ThemedText>
            </View>
          </SafeAreaView>
        </View>
      </View>

      {/* Modal for Enlarging Photo */}
      <Modal visible={isModalVisible} transparent={true} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setIsModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <FetchableImage
                imageUrl={userData?.photo || null}
                defaultImage={require("../../assets/default-user.png")}
                style={styles.modalImage}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsModalVisible(false)}
              >
                <Ionicons name="close-circle" size={40} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Tab Buttons */}
      <View style={styles.tabsWrapper}>
        <TabLink tabs={tabs} activeTabIndex={activeTabIndex} onTabPress={handleTabPress} />
      </View>

      {/* FlatList for Tab Content */}
      <FlatList
        horizontal
        pagingEnabled
        data={tabs}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: width * tabs.length }}
        keyExtractor={(item) => item}
        renderItem={({ index }) => renderTabContent(index)}
        ref={flatListRef}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          setActiveTabIndex(index);
        }}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* ========== HEADER STYLES ========== */
  headerContainer: {
    marginBottom: 0,
  },
  headerBackground: {
    paddingBottom: 30,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  profileHeader: {
    alignItems: "center",
    paddingTop: 20,
  },
  photoContainer: {
    position: "relative",
    marginBottom: 16,
  },
  userImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },
  editBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },

  /* ========== TABS STYLES ========== */
  tabsWrapper: {
    marginTop: 16,
    marginBottom: 8,
  },
  tabScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  /* ========== STATISTICS TAB ========== */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 8,
  },
  statCard: {
    width: "48%",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    opacity: 0.7,
    textAlign: "center",
  },

  /* ========== ROUTES TAB ========== */
  routesList: {
    marginTop: 8,
  },
  routeCard: {
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0, 148, 84, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  routeMetaContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  visibilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  visibilityText: {
    fontSize: 12,
    fontWeight: "600",
  },

  /* ========== ACHIEVEMENTS TAB ========== */
  achievementsList: {
    marginTop: 8,
  },
  achievementCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  achievementHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  achievementIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  achievementProgress: {
    fontSize: 14,
    opacity: 0.7,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 12,
    gap: 8,
  },
  starWrapper: {
    padding: 4,
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 40,
  },

  /* ========== SHARED STYLES ========== */
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    opacity: 0.7,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
    paddingHorizontal: 40,
  },

  /* ========== MODAL STYLES ========== */
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },
  modalContent: {
    position: "relative",
    width: "90%",
    aspectRatio: 1,
  },
  modalImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  closeButton: {
    position: "absolute",
    top: -50,
    right: 0,
  },
});

export default UserPage;
