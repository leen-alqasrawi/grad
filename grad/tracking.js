// Corrected tracking.js for student view (bus to home logic)
let locationSharing = false;
let driverTrackingInterval = null;
let locationWatchId = null;
let busPollInterval = null;
let directionsRenderer, directionsService, map;

function showMainScreen() {
  document.getElementById('mainScreen').classList.remove('hidden');
  stopLocationSharing();
  clearIntervals();
}

function showStudentLogin() {
  hideAllScreens();
  document.getElementById('studentId').value = '';
  document.getElementById('studentScreen').classList.remove('hidden');
}

function showDriverLogin() {
  hideAllScreens();
  document.getElementById('driverUsername').value = '';
  document.getElementById('driverPassword').value = '';
  document.getElementById('driverScreen').classList.remove('hidden');
}

function hideAllScreens() {
  const screens = ['mainScreen', 'studentScreen', 'driverScreen', 'mapScreen', 'driverDashboard'];
  screens.forEach(screen => document.getElementById(screen).classList.add('hidden'));
}

async function requestLocation() {
  const studentId = document.getElementById('studentId').value.trim();
  if (!studentId) return alert('Please enter your Student ID');

  try {
    const res = await fetch(`http://localhost:5000/get-student-school?studentId=${studentId}`);
    const data = await res.json();

    if (!data || !data.school || !data.home) {
      alert('Invalid Student ID or missing location.');
      return;
    }

    localStorage.setItem('schoolData', JSON.stringify(data.school));
    localStorage.setItem('homeLocation', JSON.stringify(data.home));

    showMap();
    startLocationSharing();
  } catch (error) {
    console.error('Error fetching school info:', error);
    alert('Failed to retrieve school info.');
  }
}

async function geocodeSchool(schoolName, schoolRegion = '') {
  const geocoder = new google.maps.Geocoder();
  
  const searchStrategies = [
    `مدرسة ${schoolName}`, //primary tactic: arabic
    `مدرسة ${schoolName} ${schoolRegion}`, // Primary + region
    schoolName, //first fallback: original name only
    `${schoolName} ${schoolRegion}`, // original name + region
    `${schoolName} مدرسة`, //second fallback: name + suffix
    `${schoolName} مدرسة ${schoolRegion}`, // Name + suffix + region
    `${schoolName} school`, //third fallback: english suffix
    `مدرسة ${schoolName} الأردن`, //fourth fallback: with country
    `${schoolName} الأردن`, //name with country
    `مدرسة ${schoolName} عمان`, //with capital city
    `${schoolName} عمان`, //name with capital
    `${schoolName} Jordan` //final fallback: english with country
  ];

  for (const searchTerm of searchStrategies) {
    try {
      console.log(`Trying search term: "${searchTerm}"`);
      
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ 
          address: searchTerm,
          componentRestrictions: { country: 'JO' }
        }, (results, status) => {
          if (status === 'OK' && results && results.length > 0) {
            resolve(results[0]);
          } else {
            reject(new Error(`Geocoding failed with status: ${status}`));
          }
        });
      });

      console.log(`Successfully found school with: "${searchTerm}"`);
      return result;
    } catch (error) {
      console.warn(`Search failed for "${searchTerm}":`, error.message);
      continue; // Try next strategy
    }
  }

  throw new Error('Could not find school location with any search strategy');
}

function showMap() {
  hideAllScreens();
  document.getElementById('mapScreen').classList.remove('hidden');

  const school = JSON.parse(localStorage.getItem('schoolData'));
  const homeLocation = JSON.parse(localStorage.getItem('homeLocation'));

  document.getElementById('schoolLocation').textContent = school.name;
  document.getElementById('homeLocation').textContent = `Lat: ${homeLocation.lat.toFixed(4)}, Lng: ${homeLocation.lng.toFixed(4)}`;

  // Use enhanced geocoding function with region info
  geocodeSchool(school.name, school.region)
    .then(result => {
      const schoolLatLng = result.geometry.location;
      const mapDiv = document.querySelector(".map-container .map");

      map = new google.maps.Map(mapDiv, {
        zoom: 14,
        center: homeLocation
      });

      new google.maps.Marker({ 
        position: homeLocation, 
        map, 
        title: "Home", 
        icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" 
      });
      
      new google.maps.Marker({ 
        position: schoolLatLng, 
        map, 
        title: "School", 
        icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" 
      });

      directionsService = new google.maps.DirectionsService();
      directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });
      directionsRenderer.setMap(map);

      const busMarker = new google.maps.Marker({ 
        map, 
        title: "Bus", 
        icon: "http://maps.google.com/mapfiles/ms/icons/bus.png" 
      });

      if (busPollInterval) clearInterval(busPollInterval);

      busPollInterval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:5000/track/${school.school_id}`);
          if (!res.ok) throw new Error(`Status ${res.status}`);

          const { lat: busLat, lng: busLng } = await res.json();
          busMarker.setPosition({ lat: busLat, lng: busLng });
          map.setCenter({ lat: busLat, lng: busLng });

          directionsService.route({
            origin: { lat: busLat, lng: busLng },
            destination: homeLocation,
            travelMode: google.maps.TravelMode.DRIVING
          }, (result, status) => {
            if (status === 'OK') {
              directionsRenderer.setDirections(result);
              const leg = result.routes[0].legs[0];
              const eta = leg.duration.text;
              const nextStep = leg.steps[0]?.instructions?.replace(/<[^>]*>/g, '') || "On route";
              const distance = leg.distance.value;
              let statusText = "Bus is on route";
              if (distance < 500) statusText = "Bus is approaching your stop";
              else if (distance > 2000) statusText = "Bus has left the school";

              document.getElementById('busStatus').textContent = statusText;
              document.getElementById('eta').textContent = eta;
              document.getElementById('nextStop').textContent = nextStep;
            }
          });

        } catch (err) {
          console.warn("Bus location unavailable or stale:", err.message);
          document.getElementById('busStatus').textContent = "Bus offline or out of range";
          document.getElementById('eta').textContent = "N/A";
          document.getElementById('nextStop').textContent = "N/A";
        }
      }, 10000);
    })
    .catch(error => {
      console.error("All geocoding strategies failed:", error);
      alert("Could not locate the school on the map. Please check the school name in the database.");
    });
}

function startLocationSharing() {
  if (navigator.geolocation) {
    locationWatchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude: lat, longitude: lng } = position.coords;
        localStorage.setItem('currentLocation', JSON.stringify({ lat, lng, timestamp: Date.now() }));
      },
      error => console.error('Location tracking error:', error),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );
    locationSharing = true;
  }
}

function driverLogin() {
  const username = document.getElementById('driverUsername').value.trim();
  const password = document.getElementById('driverPassword').value.trim();

  const drivers = {
    driver1: { password: 'secret123', schoolId: 'SCH057' },
    driver2: { password: 'bus456', schoolId: 'SCH002' }
  };

  const driver = drivers[username];
  if (!driver || driver.password !== password) {
    alert('Invalid username or password');
    return;
  }

  const schoolId = driver.schoolId;
  if (!navigator.geolocation) {
    alert("Geolocation not supported by your browser.");
    return;
  }

  driverTrackingInterval = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        fetch('http://localhost:5000/track/driver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolId, lat: latitude, lng: longitude })
        }).catch(err => console.error(" Failed to send driver location:", err));
      },
      error => console.error(' Driver geolocation error:', error),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );
  }, 5000);

  document.getElementById('driverDashboard').classList.remove('hidden');
  document.getElementById('driverScreen').classList.add('hidden');
}

function stopLocationSharing() {
  if (locationWatchId) navigator.geolocation.clearWatch(locationWatchId);
  if (driverTrackingInterval) clearInterval(driverTrackingInterval);
  locationSharing = false;
  locationWatchId = null;
  driverTrackingInterval = null;
}

function clearIntervals() {
  if (busPollInterval) clearInterval(busPollInterval);
  busPollInterval = null;
}

function logout() {
  localStorage.clear();
  stopLocationSharing();
  clearIntervals();
  showMainScreen();
}

window.onload = showMainScreen;