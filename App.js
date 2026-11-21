
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';

export default function App() {
  const [location, setLocation] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate distance between two GPS coordinates
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const toRadians = (degrees) => degrees * Math.PI / 180;
    const earthRadius = 6371;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return (
      2 *
      earthRadius *
      Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    );
  };

  // Find restaurants using OpenStreetMap
  const findRestaurant = async (lat, lon) => {
    const query = `
      [out:json][timeout:20];
      (
        node["amenity"="restaurant"](around:3000,${lat},${lon});
        way["amenity"="restaurant"](around:3000,${lat},${lon});
      );
      out center;
    `;

    const url =
      'https://overpass-api.de/api/interpreter?data=' +
      encodeURIComponent(query);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Restaurant search failed');
    }

    const data = await response.json();

    const restaurants = data.elements
      .map((item) => ({
        name: item.tags?.name || 'Unnamed Restaurant',
        latitude: item.lat ?? item.center?.lat,
        longitude: item.lon ?? item.center?.lon,
      }))
      .filter(
        (item) =>
          Number.isFinite(item.latitude) &&
          Number.isFinite(item.longitude)
      )
      .map((item) => ({
        ...item,
        distance: getDistance(
          lat,
          lon,
          item.latitude,
          item.longitude
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    if (restaurants.length > 0) {
      setRestaurant(restaurants[0]);
    } else {
      setError('No restaurants found within 3 km.');
    }
  };

  // Get current GPS location
  const getLocation = () => {
    if (Platform.OS !== 'web') {
      setError('This version is designed for web preview.');
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      setError('Geolocation is not supported.');
      return;
    }

    setLoading(true);
    setError('');
    setLocation(null);
    setRestaurant(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        setLocation({
          latitude: lat,
          longitude: lon,
        });

        try {
          await findRestaurant(lat, lon);
        } catch (err) {
          setError(
            'Unable to search for restaurants. Please try again.'
          );
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError(
          'Please allow location access in your browser.'
        );
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      }
    );
  };

  // Create an interactive map with two markers
  const getMapHtml = () => {
    if (!location) return '';

    const lat = location.latitude;
    const lon = location.longitude;

    const restaurantData = restaurant
      ? {
          name: restaurant.name,
          lat: restaurant.latitude,
          lon: restaurant.longitude,
        }
      : null;

    const safeRestaurant = JSON.stringify(
      restaurantData
    ).replace(/</g, '\\u003c');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport"
            content="width=device-width, initial-scale=1.0" />

          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          />

          <style>
            html, body {
              margin: 0;
              padding: 0;
              height: 100%;
            }

            #map {
              width: 100%;
              height: 100%;
            }
          </style>
        </head>

        <body>
          <div id="map"></div>

          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

          <script>
            const map = L.map('map').setView(
              [${lat}, ${lon}],
              15
            );

            L.tileLayer(
              'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
              {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
              }
            ).addTo(map);

            const myMarker = L.marker(
              [${lat}, ${lon}]
            ).addTo(map);

            myMarker.bindPopup('My Current Location');

            const restaurant = ${safeRestaurant};

            if (restaurant) {
              const restaurantMarker = L.circleMarker(
                [restaurant.lat, restaurant.lon],
                {
                  radius: 10,
                  color: 'red',
                  fillColor: 'red',
                  fillOpacity: 0.8
                }
              ).addTo(map);

              restaurantMarker.bindPopup(
                'Nearby Restaurant: ' +
                restaurant.name.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
              );

              const bounds = L.latLngBounds([
                [${lat}, ${lon}],
                [restaurant.lat, restaurant.lon]
              ]);

              map.fitBounds(bounds.pad(0.3));
            }
          </script>
        </body>
      </html>
    `;
  };

  const openRestaurant = () => {
    if (!restaurant) return;

    const url =
      'https://www.openstreetmap.org/?mlat=' +
      restaurant.latitude +
      '&mlon=' +
      restaurant.longitude +
      '#map=17/' +
      restaurant.latitude +
      '/' +
      restaurant.longitude;

    Linking.openURL(url);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>
        My Geo-location App
      </Text>

      <Text style={styles.subtitle}>
        Find my current location and nearby restaurants
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={getLocation}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Searching...' : 'Find My Location'}
        </Text>
      </TouchableOpacity>

      {loading && (
        <ActivityIndicator
          size="large"
          color="#55BCF6"
          style={styles.loading}
        />
      )}

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {location && (
        <View style={styles.result}>
          <Text style={styles.heading}>
            My Current Location
          </Text>

          <Text>
            Latitude: {location.latitude.toFixed(6)}
          </Text>

          <Text>
            Longitude: {location.longitude.toFixed(6)}
          </Text>

          {Platform.OS === 'web' && (
            <iframe
              title="My Location and Restaurant Map"
              width="100%"
              height="350"
              style={{
                border: 0,
                borderRadius: 10,
                marginTop: 15,
              }}
              srcDoc={getMapHtml()}
            />
          )}

          <Text style={styles.note}>
            Blue pin: My location
          </Text>

          {restaurant && (
            <View style={styles.restaurantBox}>
              <Text style={styles.heading}>
                Nearby Restaurant
              </Text>

              <Text style={styles.restaurantName}>
                {restaurant.name}
              </Text>

              <Text>
                Distance: {restaurant.distance.toFixed(2)} km
              </Text>

              <Text>
                Latitude: {restaurant.latitude.toFixed(6)}
              </Text>

              <Text>
                Longitude: {restaurant.longitude.toFixed(6)}
              </Text>

              <Text style={styles.restaurantNote}>
                Red marker: Restaurant location
              </Text>

              <TouchableOpacity
                style={styles.restaurantButton}
                onPress={openRestaurant}
              >
                <Text style={styles.buttonText}>
                  View Restaurant on OpenStreetMap
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#E8EAED',
    padding: 25,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 35,
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    color: '#555',
  },
  button: {
    backgroundColor: '#55BCF6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loading: {
    marginTop: 20,
  },
  result: {
    marginTop: 25,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    gap: 10,
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  note: {
    color: '#555',
    marginTop: 8,
  },
  restaurantBox: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    gap: 8,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  restaurantNote: {
    color: '#C0392B',
    fontWeight: 'bold',
  },
  restaurantButton: {
    backgroundColor: '#55BCF6',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  error: {
    color: 'red',
    marginTop: 15,
    textAlign: 'center',
  },
});
