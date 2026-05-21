import React, { useEffect, useState, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  useColorScheme,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { StackScreenProps } from "@react-navigation/stack";
import Colors from "@/constants/Colors";
import FetchableImage from "@/components/FetchableImage";
import { tagIcon } from "./ExplorePage";
import { RootStackParamList } from "..";
import { API_URL, fetchData } from "@/utils/apiHelper";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useUserContext } from "@/context/UserProvider";
import * as SecureStore from "expo-secure-store";

// 1) Import @rnmapbox/maps & your RouteOverview
import MapboxGL from "@rnmapbox/maps";
import RouteOverview from "./RouteOverview"; // Adjust path as needed

export type RouteViewProps = StackScreenProps<RootStackParamList, "RouteView">;

const RouteView: React.FC<RouteViewProps> = ({ route, navigation }) => {
  // The route param with id
  const routeId = route.params?.routeData.id;  
  const cameraRef = useRef<MapboxGL.Camera>(null);
  const { userData } = useUserContext();

  const [loading, setLoading] = useState<boolean>(true);
  const [routeData, setRouteData] = useState<any>(null);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");
  const [submittingRating, setSubmittingRating] = useState<boolean>(false);
  
  // Reviews modal state
  const [showReviewsModal, setShowReviewsModal] = useState<boolean>(false);
  
  // Edit route state
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editVisibility, setEditVisibility] = useState<string>("public");
  const [availableTags, setAvailableTags] = useState<{id: number, name: string}[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [submittingEdit, setSubmittingEdit] = useState<boolean>(false);
  
  const theme = useColorScheme() || "light";

  useEffect(() => {
    // Fetch from your API, e.g.: GET /api/auth/route/59/
    const getRouteData = async () => {
      try {
        const data = await fetchData(`${API_URL}api/auth/route/${routeId}/`);
        setRouteData(data);
      } catch (error) {
        console.error("Error fetching route data:", error);
      } finally {
        setLoading(false);
      }
    };
    getRouteData();
  }, [routeId]);

  useEffect(() => {
    // Fetch available tags
    const fetchTags = async () => {
      try {
        const accessToken = await SecureStore.getItemAsync("accessToken");
        const response = await fetch(`${API_URL}api/tags/displayable/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          setAvailableTags(data);
        }
      } catch (error) {
        console.error("Failed to fetch tags:", error);
      }
    };
    fetchTags();
  }, []);

  // Convert routeData.route (array of { lat: string, long: string }) 
  // to numeric waypoints (array of { latitude: number, longitude: number })
  const mappedWaypoints =
    routeData?.route?.map((point: { lat: string; long: string }) => ({
      latitude: parseFloat(point.lat),
      longitude: parseFloat(point.long),
    })) || [];

  // The first coordinate is the start; last is end
  const startLocation =
    mappedWaypoints.length > 0 ? mappedWaypoints[0] : null;
  const endLocation =
    mappedWaypoints.length > 0
      ? mappedWaypoints[mappedWaypoints.length - 1]
      : { latitude: 0, longitude: 0 }; // fallback

      useEffect(() => {
        if (!cameraRef.current || mappedWaypoints.length < 2 || !mapLoaded) return;
    
        // Compute min/max latitude and longitude
        const latArray = mappedWaypoints.map((wp:any) => wp.latitude);
        const lngArray = mappedWaypoints.map((wp:any) => wp.longitude);
        const minLat = Math.min(...latArray);
        const maxLat = Math.max(...latArray);
        const minLng = Math.min(...lngArray);
        const maxLng = Math.max(...lngArray);
    
        // Provide a little “padding” around the edges
        // The 3rd parameter (padding) in fitBounds is a single number in older versions.
        // If your version supports edge insets, you can pass an object. Otherwise, just pass a number.
        const padding = 10; // or 100, etc.
    
        // The 4th parameter is the animation duration in ms (optional).
        // If your version has a different signature, adjust accordingly.
        cameraRef.current.fitBounds([minLng, minLat], [maxLng, maxLat], padding, 1000);
      }, [mappedWaypoints, mapLoaded]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors[theme].primary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  if (!routeData) {
    // In case the request fails or returns null
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: "center", marginTop: 20 }}>
          No route data found
        </Text>
      </View>
    );
  }

  const handleMapPress = () => {
    // Navigate to Home with the route waypoints
    navigation.navigate("Home", {
      startLocation: startLocation,
      selectedCoordinates: endLocation,
      selectedPlaceName: routeData.title || "Unnamed Route",
      waypoints: mappedWaypoints,
    });
  };

  const handleRateRoute = () => {
    setShowRatingModal(true);
  };

  const submitRating = async () => {
    if (selectedRating === 0) {
      Alert.alert("Rating Required", "Please select a rating before submitting.");
      return;
    }

    try {
      setSubmittingRating(true);
      const accessToken = await SecureStore.getItemAsync("accessToken");
      
      const response = await fetch(`${API_URL}api/auth/review/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: routeId,
          rating: selectedRating,
          review: reviewText.trim() || null,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        let errorMessage = "Failed to submit rating";
        
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.error || errorMessage;
        } else {
          const textResponse = await response.text();
          console.error("Server returned non-JSON response:", textResponse.substring(0, 200));
          errorMessage = `Server error (${response.status})`;
        }
        
        throw new Error(errorMessage);
      }

      Alert.alert("Success", "Your rating has been submitted!");
      setShowRatingModal(false);
      setSelectedRating(0);
      setReviewText("");
      
      // Refresh route data to show updated rating
      const data = await fetchData(`${API_URL}api/auth/route/${routeId}/`);
      setRouteData(data);
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      Alert.alert("Error", error.message || "Failed to submit rating. Please try again.");
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleEditRoute = () => {
    // Populate edit form with current data
    setEditTitle(routeData.title || "");
    setEditVisibility(routeData.visibility || "public");
    
    // Map tag names to IDs
    const tagIds = routeData.tags?.map((tagName: string) => {
      const tag = availableTags.find(t => t.name === tagName);
      return tag?.id;
    }).filter((id: number | undefined): id is number => id !== undefined) || [];
    setSelectedTagIds(tagIds);
    
    setShowEditModal(true);
  };

  const handleToggleTag = (tagId: number) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const submitEdit = async () => {
    if (!editTitle.trim()) {
      Alert.alert("Title Required", "Please enter a route title.");
      return;
    }

    try {
      setSubmittingEdit(true);
      const accessToken = await SecureStore.getItemAsync("accessToken");
      
      const response = await fetch(`${API_URL}api/auth/route/${routeId}/`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          visibility: editVisibility,
          tag_ids: selectedTagIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update route");
      }

      Alert.alert("Success", "Route updated successfully!");
      setShowEditModal(false);
      
      // Refresh route data
      const data = await fetchData(`${API_URL}api/auth/route/${routeId}/`);
      setRouteData(data);
    } catch (error: any) {
      console.error("Error updating route:", error);
      Alert.alert("Error", error.message || "Failed to update route. Please try again.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const isOwner = userData?.username === routeData?.user?.username;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[theme].background },
      ]}
    >
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >

        {/* Full-width Map at Top */}
        {mappedWaypoints.length >= 2 && (
          <TouchableOpacity 
            style={styles.mapContainer}
            onPress={handleMapPress}
            activeOpacity={0.9}
          >
            <MapboxGL.MapView
              style={styles.map}
              styleURL={
                theme === "dark"
                  ? "mapbox://styles/mapbox/dark-v11"
                  : MapboxGL.StyleURL.Street
              }
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              onDidFinishRenderingFrameFully={() => { setMapLoaded(true) }}
            >
              <RouteOverview
                startLocation={startLocation}
                endLocation={endLocation}
                waypoints={mappedWaypoints}
              />
              <MapboxGL.Camera ref={cameraRef} />
            </MapboxGL.MapView>
            
            {/* Floating title over map */}
            <BlurView
              intensity={80}
              tint={theme === "dark" ? "dark" : "light"}
              style={styles.titleOverlay}
            >
              <Text style={[styles.title, { color: Colors[theme].text }]}>
                {routeData.title || "Unnamed Route"}
              </Text>
            </BlurView>

            {/* Tap to open indicator */}
            <View style={styles.tapIndicator}>
              <Ionicons name="expand-outline" size={20} color="white" />
              <Text style={styles.tapIndicatorText}>Tap to open in full map</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: Colors[theme].primary }]}>
            <Ionicons name="walk" size={28} color={Colors[theme].buttonText} />
            <Text style={[styles.statValue, { color: Colors[theme].buttonText }]}>
              {routeData.distance} km
            </Text>
            <Text style={[styles.statLabel, { color: Colors[theme].buttonText, opacity: 0.8 }]}>
              Distance
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: Colors[theme].primary }]}>
            <Ionicons name="time" size={28} color={Colors[theme].buttonText} />
            <Text style={[styles.statValue, { color: Colors[theme].buttonText }]}>
              {routeData.estimated_time}
            </Text>
            <Text style={[styles.statLabel, { color: Colors[theme].buttonText, opacity: 0.8 }]}>
              Duration
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.statCard, { backgroundColor: Colors[theme].primary }]}
            onPress={() => setShowReviewsModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="star" size={28} color={Colors[theme].buttonText} />
            <Text style={[styles.statValue, { color: Colors[theme].buttonText }]}>
              {routeData.average_rating || "N/A"}
            </Text>
            <Text style={[styles.statLabel, { color: Colors[theme].buttonText, opacity: 0.8 }]}>
              Rating
            </Text>
            {routeData.reviews && routeData.reviews.length > 0 && (
              <Text style={[styles.reviewCount, { color: Colors[theme].buttonText, opacity: 0.8 }]}>
                ({routeData.reviews.length} reviews)
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Creator Info Card */}
        {routeData.user && (
          <View style={[styles.creatorCard, { backgroundColor: theme === "dark" ? "#1c1c1e" : "#fff" }]}>
            <Text style={[styles.sectionTitle, { color: Colors[theme].text }]}>
              Created by
            </Text>
            <View style={styles.creatorRow}>
              <FetchableImage
                imageUrl={routeData.user.photo}
                defaultImage={require("../../assets/default-user.png")}
                style={styles.creatorImage}
              />
              <View style={styles.creatorInfo}>
                <Text style={[styles.creatorName, { color: Colors[theme].text }]}>
                  {routeData.user.username}
                </Text>
                <Text style={[styles.creatorRole, { color: Colors[theme].text, opacity: 0.6 }]}>
                  Route Creator
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Tags Section */}
        {routeData.tags && routeData.tags.length > 0 && (
          <View style={[styles.tagsCard, { backgroundColor: theme === "dark" ? "#1c1c1e" : "#fff" }]}>
            <Text style={[styles.sectionTitle, { color: Colors[theme].text }]}>
              Route Tags
            </Text>
            <View style={styles.tagsGrid}>
              {routeData.tags.map((tag: string, index: number) => (
                <View 
                  key={index} 
                  style={[
                    styles.modernTag,
                    { backgroundColor: Colors[theme].primary }
                  ]}
                >
                  <Image
                    source={tagIcon(tag)}
                    style={styles.tagIcon}
                  />
                  <Text style={[styles.tagText, { color: Colors[theme].buttonText }]}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {!isOwner && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors[theme].primary }]}
              onPress={handleRateRoute}
              activeOpacity={0.8}
            >
              <Ionicons name="star-outline" size={22} color={Colors[theme].buttonText} />
              <Text style={[styles.actionButtonText, { color: Colors[theme].buttonText }]}>
                Rate Route
              </Text>
            </TouchableOpacity>
          )}
          
          {isOwner && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: Colors[theme].primary }]}
              onPress={handleEditRoute}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={22} color={Colors[theme].buttonText} />
              <Text style={[styles.actionButtonText, { color: Colors[theme].buttonText }]}>
                Edit Route
              </Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme === "dark" ? "#1c1c1e" : "#fff" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors[theme].text }]}>
                Rate This Route
              </Text>
              <TouchableOpacity onPress={() => setShowRatingModal(false)}>
                <Ionicons name="close" size={28} color={Colors[theme].text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.ratingLabel, { color: Colors[theme].text }]}>
              How would you rate this route?
            </Text>
            
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= selectedRating ? "star" : "star-outline"}
                    size={40}
                    color={star <= selectedRating ? "#FFD700" : Colors[theme].text}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.ratingLabel, { color: Colors[theme].text, marginTop: 20 }]}>
              Add a review (optional)
            </Text>
            
            <TextInput
              style={[
                styles.reviewInput,
                { 
                  backgroundColor: theme === "dark" ? "#2c2c2e" : "#f5f5f5",
                  color: Colors[theme].text 
                }
              ]}
              placeholder="Share your experience..."
              placeholderTextColor={Colors[theme].text + "80"}
              multiline
              numberOfLines={4}
              value={reviewText}
              onChangeText={setReviewText}
              maxLength={500}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowRatingModal(false);
                  setSelectedRating(0);
                  setReviewText("");
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton, { backgroundColor: Colors[theme].primary }]}
                onPress={submitRating}
                disabled={submittingRating}
              >
                {submittingRating ? (
                  <ActivityIndicator color={Colors[theme].buttonText} />
                ) : (
                  <Text style={[styles.submitButtonText, { color: Colors[theme].buttonText }]}>
                    Submit Rating
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Route Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView 
            contentContainerStyle={styles.editModalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.modalContent, { backgroundColor: theme === "dark" ? "#1c1c1e" : "#fff" }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: Colors[theme].text }]}>
                  Edit Route
                </Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close" size={28} color={Colors[theme].text} />
                </TouchableOpacity>
              </View>

              {/* Title Input */}
              <Text style={[styles.inputLabel, { color: Colors[theme].text }]}>
                Route Title
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { 
                    backgroundColor: theme === "dark" ? "#2c2c2e" : "#f5f5f5",
                    color: Colors[theme].text 
                  }
                ]}
                placeholder="Enter route title"
                placeholderTextColor={Colors[theme].text + "80"}
                value={editTitle}
                onChangeText={setEditTitle}
                maxLength={100}
              />

              {/* Privacy Toggle */}
              <View style={styles.privacySection}>
                <View style={styles.privacyInfo}>
                  <Text style={[styles.inputLabel, { color: Colors[theme].text }]}>
                    Public Route
                  </Text>
                  <Text style={[styles.privacyDescription, { color: Colors[theme].text, opacity: 0.6 }]}>
                    {editVisibility === "public" ? "Visible to all users" : "Only visible to you"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    { backgroundColor: editVisibility === "public" ? Colors[theme].primary : "#ccc" }
                  ]}
                  onPress={() => setEditVisibility(editVisibility === "public" ? "private" : "public")}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.toggleKnob,
                    editVisibility === "public" && styles.toggleKnobActive
                  ]} />
                </TouchableOpacity>
              </View>

              {/* Tags Selection */}
              <Text style={[styles.inputLabel, { color: Colors[theme].text, marginTop: 20 }]}>
                Route Tags
              </Text>
              <View style={styles.tagsSelection}>
                {availableTags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.tagChip,
                      selectedTagIds.includes(tag.id) && {
                        backgroundColor: Colors[theme].primary
                      },
                      !selectedTagIds.includes(tag.id) && {
                        backgroundColor: theme === "dark" ? "#2c2c2e" : "#f5f5f5",
                        borderWidth: 1,
                        borderColor: Colors[theme].primary + "40"
                      }
                    ]}
                    onPress={() => handleToggleTag(tag.id)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={tagIcon(tag.name)}
                      style={styles.tagChipIcon}
                    />
                    <Text
                      style={[
                        styles.tagChipText,
                        { color: selectedTagIds.includes(tag.id) 
                          ? Colors[theme].buttonText 
                          : Colors[theme].text 
                        }
                      ]}
                    >
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton, { backgroundColor: Colors[theme].primary }]}
                  onPress={submitEdit}
                  disabled={submittingEdit}
                >
                  {submittingEdit ? (
                    <ActivityIndicator color={Colors[theme].buttonText} />
                  ) : (
                    <Text style={[styles.submitButtonText, { color: Colors[theme].buttonText }]}>
                      Save Changes
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Reviews Modal */}
      <Modal
        visible={showReviewsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReviewsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.reviewsModalContent, { backgroundColor: theme === "dark" ? "#1c1c1e" : "#fff" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors[theme].text }]}>
                Reviews ({routeData?.reviews?.length || 0})
              </Text>
              <TouchableOpacity onPress={() => setShowReviewsModal(false)}>
                <Ionicons name="close" size={28} color={Colors[theme].text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.reviewsList} showsVerticalScrollIndicator={false}>
              {routeData?.reviews && routeData.reviews.length > 0 ? (
                routeData.reviews.map((review: any, index: number) => (
                  <View 
                    key={index} 
                    style={[
                      styles.reviewItem,
                      { 
                        backgroundColor: theme === "dark" ? "#2c2c2e" : "#f5f5f5",
                        borderBottomWidth: index < routeData.reviews.length - 1 ? 1 : 0,
                        borderBottomColor: theme === "dark" ? "#3c3c3e" : "#e0e0e0"
                      }
                    ]}
                  >
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewUserInfo}>
                        <FetchableImage
                          imageUrl={review.user?.photo}
                          defaultImage={require("../../assets/default-user.png")}
                          style={styles.reviewUserAvatar}
                        />
                        <View>
                          <Text style={[styles.reviewUserName, { color: Colors[theme].text }]}>
                            {review.user?.username || "Anonymous"}
                          </Text>
                          <View style={styles.reviewStars}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Ionicons
                                key={star}
                                name={star <= review.rating ? "star" : "star-outline"}
                                size={16}
                                color="#FFD700"
                              />
                            ))}
                          </View>
                        </View>
                      </View>
                      {review.votes !== undefined && (
                        <View style={styles.reviewVotes}>
                          <Ionicons name="thumbs-up" size={16} color={Colors[theme].primary} />
                          <Text style={[styles.reviewVotesText, { color: Colors[theme].text }]}>
                            {review.votes}
                          </Text>
                        </View>
                      )}
                    </View>
                    {review.review && (
                      <Text style={[styles.reviewText, { color: Colors[theme].text }]}>
                        {review.review}
                      </Text>
                    )}
                    {review.created_at && (
                      <Text style={[styles.reviewDate, { color: Colors[theme].text, opacity: 0.5 }]}>
                        {new Date(review.created_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyReviews}>
                  <Ionicons name="chatbox-outline" size={48} color={Colors[theme].text} opacity={0.3} />
                  <Text style={[styles.emptyReviewsText, { color: Colors[theme].text, opacity: 0.6 }]}>
                    No reviews yet
                  </Text>
                  <Text style={[styles.emptyReviewsSubtext, { color: Colors[theme].text, opacity: 0.4 }]}>
                    Be the first to review this route!
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

/** STYLES **/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  mapContainer: {
    width: "100%",
    height: 320,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  titleOverlay: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    borderRadius: 15,
    overflow: "hidden",
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    marginTop: -40,
    marginBottom: 20,
    zIndex: 10,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 20,
    padding: 15,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  creatorCard: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 20,
    padding: 20,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },
  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  creatorImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 15,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 2,
  },
  creatorRole: {
    fontSize: 14,
  },
  tagsCard: {
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 20,
    padding: 20,
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
  tagsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
  },
  modernTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginRight: 10,
    marginBottom: 10,
  },
  tagIcon: {
    width: 22,
    height: 22,
    marginRight: 8,
  },
  tagText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tapIndicator: {
    position: "absolute",
    bottom: 15,
    right: 15,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  tapIndicatorText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 10,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 15,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 15,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 15,
  },
  starButton: {
    padding: 5,
  },
  reviewInput: {
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    textAlignVertical: "top",
    minHeight: 100,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    // backgroundColor set dynamically with theme
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  editModalScroll: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  textInput: {
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    marginBottom: 20,
  },
  privacySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingVertical: 10,
  },
  privacyInfo: {
    flex: 1,
  },
  privacyDescription: {
    fontSize: 13,
    marginTop: 4,
  },
  toggleSwitch: {
    width: 60,
    height: 32,
    borderRadius: 16,
    padding: 3,
    justifyContent: "center",
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "white",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  tagsSelection: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    gap: 6,
  },
  tagChipIcon: {
    width: 18,
    height: 18,
  },
  tagChipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  reviewCount: {
    fontSize: 11,
    marginTop: 4,
  },
  reviewsModalContent: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    maxHeight: "80%",
  },
  reviewsList: {
    marginTop: 10,
  },
  reviewItem: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  reviewUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  reviewUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  reviewUserName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  reviewStars: {
    flexDirection: "row",
    gap: 2,
  },
  reviewVotes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  reviewVotesText: {
    fontSize: 13,
    fontWeight: "600",
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
  },
  emptyReviews: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyReviewsText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 15,
  },
  emptyReviewsSubtext: {
    fontSize: 14,
    marginTop: 5,
  },
});

export default RouteView;
