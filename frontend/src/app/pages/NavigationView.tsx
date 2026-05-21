import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  useColorScheme,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import MapboxGL from "@rnmapbox/maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

import { StackScreenProps } from "@react-navigation/stack";
import { RootStackParamList } from "@/app";
import Colors from "@/constants/Colors";
import { mapboxToken } from "@/utils/apiHelper";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Extended Step interface to include bearing data for maneuver arrows
interface Step {
  instruction: string;
  distance: number; // in meters
  duration: number; // in seconds
  location: [number, number];
  bearing_after?: number;
  bearing_before?: number;
  maneuverType?: string;
  maneuverModifier?: string;
}

type NavigationViewProps = StackScreenProps<RootStackParamList, "NavigationView">;

const NAVIGATION_DISTANCE_THRESHOLD = 15; // meters
const INITIAL_ZOOM_LEVEL = 17;
const NAVIGATION_ZOOM_LEVEL = 18;

const NavigationView: React.FC<NavigationViewProps> = ({ route, navigation }) => {
  const { waypoints } = route.params;

  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);

  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [currentSpeed, setCurrentSpeed] = useState<number>(0); // m/s

  const [remainingStepDistance, setRemainingStepDistance] = useState<number>(0);
  const [totalRemainingDistance, setTotalRemainingDistance] = useState<number>(0);
  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [routeDuration, setRouteDuration] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number>(0);

  // Tracks whether the map is currently centered on the user's location
  const [isCentered, setIsCentered] = useState<boolean>(true);
  const [isNavigationStarted, setIsNavigationStarted] = useState<boolean>(false);

  // Animation for instruction banner
  const bannerAnim = useRef(new Animated.Value(0)).current;

  const mapRef = useRef<MapboxGL.Camera | null>(null);
  const scheme = useColorScheme() || "light";
  const themeColors = Colors[scheme];


  useEffect(() => {
    if (!waypoints || waypoints.length < 2) {
      Alert.alert("Invalid Input", "Waypoints are missing or invalid.");
      return;
    }
    fetchRouteData();
    startLocationTracking();
    return () => {
      stopLocationTracking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints]);

  /**
   * Fetch route + steps from Mapbox, storing step bearings for maneuver arrows
   */
  const fetchRouteData = async () => {
    try {
      const coordinateQuery = waypoints
        .map((wp) => `${wp.longitude}%2C${wp.latitude}`)
        .join("%3B");

      // Using overview=full for a smoother route with banner_instructions
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinateQuery}?steps=true&banner_instructions=true&geometries=geojson&overview=full&access_token=${mapboxToken}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.routes || !data.routes[0]) {
        Alert.alert("No route found", "Please check your selected waypoints.");
        return;
      }

      const route = data.routes[0];

      // Flatten steps from each leg
      const stepsData: Step[] = route.legs.flatMap((leg: any) =>
        leg.steps.map((step: any) => ({
          instruction: step.maneuver.instruction,
          distance: step.distance,
          duration: step.duration,
          location: step.maneuver.location,
          bearing_after: step.maneuver?.bearing_after || 0,
          bearing_before: step.maneuver?.bearing_before || 0,
          maneuverType: step.maneuver?.type || "turn",
          maneuverModifier: step.maneuver?.modifier || "",
        }))
      );
      setSteps(stepsData);
      setRouteDistance(route.distance);
      setRouteDuration(route.duration);
      setTotalRemainingDistance(route.distance);
      setEstimatedTimeRemaining(route.duration);

      // Build route geometry
      const routeGeoJsonData = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: route.geometry,
            properties: {},
          },
        ],
      };
      setRouteGeoJSON(routeGeoJsonData);

      // Initialize distance
      if (stepsData.length > 0) {
        setRemainingStepDistance(stepsData[0].distance);
      }

      // Animate banner entrance
      Animated.spring(bannerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } catch (error) {
      console.error("Error fetching route data:", error);
      Alert.alert("Error", "Failed to fetch navigation steps.");
    }
  };

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Location access is required for navigation.");
      return;
    }

    await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      (location) => {
        const userLoc: [number, number] = [
          location.coords.longitude,
          location.coords.latitude,
        ];
        setCurrentLocation(userLoc);
        setHeading(location.coords.heading || 0);
        setCurrentSpeed(location.coords.speed || 0);

        if (isCentered && isNavigationStarted) {
          rotateCamera(userLoc, location.coords.heading || 0);
        }
        updateDistances(userLoc);
      }
    );
  };

  const stopLocationTracking = () => {
    // If using watchPositionAsync, store the subscription and remove it if needed.
  };

  const rotateCamera = (location: [number, number], headingValue: number) => {
    if (mapRef.current) {
      mapRef.current.setCamera({
        centerCoordinate: location,
        heading: headingValue,
        pitch: 60,             // tilt for a 3D perspective (Google Maps style)
        zoomLevel: isNavigationStarted ? NAVIGATION_ZOOM_LEVEL : INITIAL_ZOOM_LEVEL,
        animationDuration: 500,
      });
    }
  };

  const updateDistances = (userLocation: [number, number]) => {
    if (steps.length === 0) return;
    
    const nextStep = steps[currentStepIndex];
    const dist = calculateDistance(userLocation, nextStep.location);
    setRemainingStepDistance(dist);

    // Calculate total remaining distance
    let totalRemaining = dist;
    for (let i = currentStepIndex + 1; i < steps.length; i++) {
      totalRemaining += steps[i].distance;
    }
    setTotalRemainingDistance(totalRemaining);

    // Update estimated time (assuming average walking speed of 1.4 m/s)
    const avgSpeed = currentSpeed > 0.5 ? currentSpeed : 1.4;
    setEstimatedTimeRemaining(totalRemaining / avgSpeed);

    if (dist < NAVIGATION_DISTANCE_THRESHOLD) {
      handleNextStep();
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex >= steps.length - 1) {
      Alert.alert(
        "Destination Reached", 
        "You have arrived at your destination!",
        [
          { text: "End Navigation", onPress: () => navigation.goBack() }
        ]
      );
      return;
    }
    const nextIndex = currentStepIndex + 1;
    setCurrentStepIndex(nextIndex);
    setRemainingStepDistance(steps[nextIndex].distance);

    // Animate instruction change
    Animated.sequence([
      Animated.timing(bannerAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(bannerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
    ]).start();
  };

  const calculateDistance = (loc1: [number, number], loc2: [number, number]) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (loc1[1] * Math.PI) / 180;
    const φ2 = (loc2[1] * Math.PI) / 180;
    const Δφ = ((loc2[1] - loc1[1]) * Math.PI) / 180;
    const Δλ = ((loc2[0] - loc1[0]) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  };

  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  const formatStepDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `In ${(meters / 1000).toFixed(1)} km`;
    }
    if (meters > 100) {
      return `In ${Math.round(meters / 50) * 50} m`;
    }
    if (meters > 50) {
      return `In ${Math.round(meters / 10) * 10} m`;
    }
    return `Now`;
  };

  const startNavigation = () => {
    setIsNavigationStarted(true);
    if (currentLocation && mapRef.current) {
      rotateCamera(currentLocation, heading);
    }
  };

  const recenterCamera = () => {
    if (!currentLocation || !mapRef.current) return;
    rotateCamera(currentLocation, heading);
    setIsCentered(true);
  };

  const endNavigation = () => {
    Alert.alert(
      "End Navigation", 
      "Are you sure you want to stop navigation?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "End", 
          style: "destructive",
          onPress: () => navigation.goBack() 
        }
      ]
    );
  };

  // Get maneuver icon name based on instruction type
  const getManeuverIcon = (step: Step): string => {
    if (!step) return "arrow-up";

    const type = step.maneuverType?.toLowerCase() || "";
    const modifier = step.maneuverModifier?.toLowerCase() || "";

    // Arrival
    if (type === "arrive") {
      return "flag";
    }

    // Depart
    if (type === "depart") {
      return "navigate";
    }

    // U-turn
    if (modifier.includes("uturn")) {
      return "return-down-back";
    }

    // Sharp left
    if (modifier === "sharp left") {
      return "arrow-back";
    }

    // Sharp right
    if (modifier === "sharp right") {
      return "arrow-forward";
    }

    // Left turns
    if (modifier.includes("left")) {
      return "arrow-back";
    }

    // Right turns
    if (modifier.includes("right")) {
      return "arrow-forward";
    }

    // Straight
    if (modifier.includes("straight") || type === "continue") {
      return "arrow-up";
    }

    // Roundabout
    if (type.includes("roundabout") || type.includes("rotary")) {
      return "sync";
    }

    // Default
    return "arrow-up";
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={
          scheme === "dark"
            ? "mapbox://styles/mapbox/navigation-night-v1"
            : "mapbox://styles/mapbox/navigation-day-v1"
        }
        onTouchStart={() => setIsCentered(false)}
      >
        <MapboxGL.Camera ref={mapRef} />

        {/* Show user's location on the map with heading */}
        <MapboxGL.UserLocation
          visible
          showsUserHeadingIndicator
          androidRenderMode="compass"
        />

        {/* The main route line with gradient effect */}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="routeSource" shape={routeGeoJSON}>
            {/* Outer glow */}
            <MapboxGL.LineLayer
              id="routeLineGlow"
              style={{
                lineColor: scheme === "dark" ? "#6B9DFF" : "#4A90E2",
                lineWidth: 10,
                lineOpacity: 0.3,
                lineBlur: 4,
              }}
            />
            {/* Main route line */}
            <MapboxGL.LineLayer
              id="routeLine"
              style={{
                lineColor: scheme === "dark" ? "#5A8DFF" : themeColors.primary,
                lineWidth: 6,
                lineOpacity: 1,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Start marker */}
        <MapboxGL.PointAnnotation
          id="start"
          coordinate={[waypoints[0].longitude, waypoints[0].latitude]}
        >
          <View style={[styles.startMarkerInner, { backgroundColor: themeColors.primary }]}>
            <Ionicons name="location" size={16} color={themeColors.buttonText} />
          </View>
        </MapboxGL.PointAnnotation>

        {/* End marker */}
        <MapboxGL.PointAnnotation
          id="end"
          coordinate={[
            waypoints[waypoints.length - 1].longitude,
            waypoints[waypoints.length - 1].latitude,
          ]}
        >
          <View style={[styles.destinationMarkerInner, { backgroundColor: themeColors.secondary }]}>
            <Ionicons name="flag" size={20} color={themeColors.buttonText} />
          </View>
        </MapboxGL.PointAnnotation>
      </MapboxGL.MapView>

      {/* TOP INSTRUCTION BANNER - Google Maps style */}
      {steps.length > 0 && (
        <Animated.View 
          style={[
            styles.topBanner, 
            { 
              backgroundColor: scheme === "dark" ? "#1E1E1E" : "#FFFFFF",
              transform: [
                {
                  translateY: bannerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-100, 0],
                  }),
                },
              ],
            }
          ]}
        >
          {/* Main instruction row */}
          <View style={styles.mainInstructionRow}>
            {/* Large maneuver icon */}
            <View style={[styles.maneuverIconContainer, { backgroundColor: themeColors.primary }]}>
              <Ionicons
                name={getManeuverIcon(steps[currentStepIndex]) as any}
                size={32}
                color={themeColors.buttonText}
              />
            </View>

            {/* Instruction text and distance */}
            <View style={styles.instructionTextContainer}>
              <Text style={[styles.distanceText, { color: themeColors.primary }]}>
                {formatStepDistance(remainingStepDistance)}
              </Text>
              <Text style={[styles.instructionText, { color: themeColors.text }]} numberOfLines={2}>
                {steps[currentStepIndex]?.instruction || "Loading..."}
              </Text>
            </View>
          </View>

          {/* Next step preview (if exists) */}
          {steps[currentStepIndex + 1] && (
            <View style={[styles.nextStepPreview, { borderTopColor: themeColors.border }]}>
              <Text style={[styles.thenLabel, { color: themeColors.textLight }]}>Then</Text>
              <Ionicons
                name={getManeuverIcon(steps[currentStepIndex + 1]) as any}
                size={18}
                color={themeColors.textLight}
                style={{ marginRight: 8 }}
              />
              <Text 
                style={[styles.nextStepText, { color: themeColors.textLight }]} 
                numberOfLines={1}
              >
                {steps[currentStepIndex + 1].instruction}
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* BOTTOM CONTROL BAR - Google Maps style */}
      <View style={[styles.bottomBar, { backgroundColor: scheme === "dark" ? "#1E1E1E" : "#FFFFFF" }]}>
        {/* ETA and Distance */}
        <View style={styles.etaContainer}>
          <Text style={[styles.etaTime, { color: themeColors.primary }]}>
            {formatDuration(estimatedTimeRemaining)}
          </Text>
          <Text style={[styles.etaDistance, { color: themeColors.textLight }]}>
            {formatDistance(totalRemainingDistance)}
          </Text>
        </View>

        {/* Control buttons */}
        <View style={styles.controlButtons}>
          {/* Recenter button */}
          {!isCentered && (
            <TouchableOpacity 
              onPress={recenterCamera} 
              style={[styles.controlButton, { backgroundColor: themeColors.primary }]}
            >
              <Ionicons name="navigate" size={24} color={themeColors.buttonText} />
            </TouchableOpacity>
          )}

          {/* Start/Stop navigation button */}
          {!isNavigationStarted ? (
            <TouchableOpacity 
              onPress={startNavigation}
              style={[styles.startButton, { backgroundColor: themeColors.primary }]}
            >
              <Ionicons name="play" size={20} color={themeColors.buttonText} />
              <Text style={[styles.startButtonText, { color: themeColors.buttonText }]}>
                Start
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={endNavigation}
              style={[styles.controlButton, { backgroundColor: themeColors.error }]}
            >
              <Ionicons name="close" size={24} color={themeColors.buttonText} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Overview button (top-right) */}
      <TouchableOpacity 
        style={[styles.overviewButton, { backgroundColor: scheme === "dark" ? "#1E1E1E" : "#FFFFFF" }]}
        onPress={() => {
          if (mapRef.current && routeGeoJSON) {
            // Zoom out to show entire route
            setIsCentered(false);
            setIsNavigationStarted(false);
          }
        }}
      >
        <Ionicons name="resize-outline" size={20} color={themeColors.text} />
      </TouchableOpacity>
    </View>
  );
};

export default NavigationView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },

  /* ---------- MARKERS ---------- */
  startMarkerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  destinationMarkerInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },

  /* ---------- TOP INSTRUCTION BANNER ---------- */
  topBanner: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 999,
  },
  mainInstructionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  maneuverIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  instructionTextContainer: {
    flex: 1,
  },
  distanceText: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 20,
  },
  nextStepPreview: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  thenLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginRight: 8,
  },
  nextStepText: {
    fontSize: 13,
    flex: 1,
  },

  /* ---------- BOTTOM CONTROL BAR ---------- */
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 15,
  },
  etaContainer: {
    flex: 1,
  },
  etaTime: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 2,
  },
  etaDistance: {
    fontSize: 14,
    fontWeight: "500",
  },
  controlButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    gap: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },

  /* ---------- OVERVIEW BUTTON ---------- */
  overviewButton: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
