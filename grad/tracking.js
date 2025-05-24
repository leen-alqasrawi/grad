// ====================================================================================================
// GLOBAL VARIABLES
// ====================================================================================================
let locationSharing = false;
let driverTrackingInterval = null;
let locationWatchId = null;
let busPollInterval = null;
let directionsRenderer, directionsService, map;
let simulationInterval = null;
let isSimulating = false;

// ====================================================================================================
// INITIALIZATION FUNCTION
// ====================================================================================================
function initializeApp() {
  console.log('🚀 Initializing tracking app...');
  
  // ✅ Set up all event listeners when page loads
  setupEventListeners();
  
  // Show main screen by default
  showMainScreen();
}

function setupEventListeners() {
  // Main screen buttons
  document.getElementById('trackBusBtn')?.addEventListener('click', showStudentLogin);
  document.getElementById('driverLoginLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    showDriverLogin();
  });

  // Student screen buttons
  document.getElementById('continueBtn')?.addEventListener('click', requestLocation);
  document.getElementById('backToMainBtn')?.addEventListener('click', showMainScreen);

  // Driver screen buttons
  document.getElementById('driverLoginBtn')?.addEventListener('click', driverLogin);
  document.getElementById('backToMainBtn2')?.addEventListener('click', showMainScreen);

  // Map screen buttons
  document.getElementById('exitTrackingBtn')?.addEventListener('click', showMainScreen);

  // Driver dashboard buttons
  document.getElementById('logoutBtn')?.addEventListener('click', logout);

  console.log('✅ Event listeners set up successfully');
}

// ====================================================================================================
// SCREEN NAVIGATION FUNCTIONS
// ====================================================================================================
function showMainScreen() {
  console.log('📱 Showing main screen');
  hideAllScreens();
  document.getElementById('mainScreen').classList.remove('hidden');
  stopLocationSharing();
  clearIntervals();
  stopSimulation();
}

function showStudentLogin() {
  console.log('📱 Showing student login screen');
  hideAllScreens();
  document.getElementById('studentId').value = '';
  document.getElementById('studentScreen').classList.remove('hidden');
}

function showDriverLogin() {
  console.log('📱 Showing driver login screen');
  hideAllScreens();
  document.getElementById('driverUsername').value = '';
  document.getElementById('driverPassword').value = '';
  document.getElementById('driverScreen').classList.remove('hidden');
}

function hideAllScreens() {
  const screens = ['mainScreen', 'studentScreen', 'driverScreen', 'mapScreen', 'driverDashboard'];
  screens.forEach(screen => {
    const element = document.getElementById(screen);
    if (element) element.classList.add('hidden');
  });
}

// ====================================================================================================
// STUDENT TRACKING FUNCTIONS
// ====================================================================================================
async function requestLocation() {
  const studentId = document.getElementById('studentId').value.trim();
  if (!studentId) {
    alert('Please enter your Student ID');
    return;
  }

  try {
    console.log(`🔍 Fetching student data for ID: ${studentId}`);
    const res = await fetch(`http://localhost:5000/get-student-school?studentId=${studentId}`);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log('📊 Student data received:', data);

    if (!data || !data.school || !data.home) {
      alert('Invalid Student ID or missing location data.');
      return;
    }

    localStorage.setItem('schoolData', JSON.stringify(data.school));
    localStorage.setItem('homeLocation', JSON.stringify(data.home));
    
    console.log(`🏫 School ID to track: ${data.school.school_id}`);

    showMap();
    startLocationSharing();
  } catch (error) {
    console.error('❌ Error fetching school info:', error);
    alert('Failed to retrieve school information. Please try again.');
  }
}

function showMap() {
  console.log('🗺️ Initializing map screen');
  hideAllScreens();
  document.getElementById('mapScreen').classList.remove('hidden');

  const school = JSON.parse(localStorage.getItem('schoolData') || '{}');
  const homeLocation = JSON.parse(localStorage.getItem('homeLocation') || '{}');

  if (!school.name || !homeLocation.lat) {
    alert('Missing location data. Please try again.');
    showMainScreen();
    return;
  }

  document.getElementById('schoolLocation').textContent = school.name;
  document.getElementById('homeLocation').textContent = `Lat: ${homeLocation.lat.toFixed(4)}, Lng: ${homeLocation.lng.toFixed(4)}`;

  geocodeSchool(school.name, school.region)
    .then(result => {
      const schoolLatLng = result.geometry.location;
      const mapDiv = document.getElementById("map");

      if (!mapDiv) {
        console.error('❌ Map container not found');
        return;
      }

      // Initialize Google Map
      map = new google.maps.Map(mapDiv, {
        zoom: 14,
        center: homeLocation
      });

      // Add markers
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

      // Initialize directions
      directionsService = new google.maps.DirectionsService();
      directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });
      directionsRenderer.setMap(map);

      const busMarker = new google.maps.Marker({ 
        map, 
        title: "Bus", 
        icon: "http://maps.google.com/mapfiles/ms/icons/bus.png" 
      });

      startBusTracking(school.school_id, busMarker, homeLocation);

    })
    .catch(error => {
      console.error("❌ Geocoding failed:", error);
      alert("Could not locate the school on the map. Please check the school name.");
      showMainScreen();
    });
}

function startBusTracking(schoolId, busMarker, homeLocation) {
  if (busPollInterval) clearInterval(busPollInterval);

  console.log(`🚌 Starting bus tracking for school: ${schoolId}`);

  busPollInterval = setInterval(async () => {
    try {
      const trackingUrl = `http://localhost:5000/track/${schoolId}`;
      const res = await fetch(trackingUrl);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const busData = await res.json();
      const { lat: busLat, lng: busLng } = busData;
      
      if (busLat && busLng) {
        console.log(`🚌 Updating bus position: ${busLat}, ${busLng}`);
        busMarker.setPosition({ lat: busLat, lng: busLng });
        map.setCenter({ lat: busLat, lng: busLng });

        // Calculate route to home
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
      }

    } catch (err) {
      console.error("❌ Bus location fetch failed:", err);
      document.getElementById('busStatus').textContent = "Bus offline or out of range";
      document.getElementById('eta').textContent = "N/A";
      document.getElementById('nextStop').textContent = "N/A";
    }
  }, 3000);
}

async function geocodeSchool(schoolName, schoolRegion = '') {
  const geocoder = new google.maps.Geocoder();
  
  const searchStrategies = [
    `مدرسة ${schoolName}`,
    `مدرسة ${schoolName} ${schoolRegion}`,
    `${schoolName} مدرسة`,
    `${schoolName} school`,
    `${schoolName} الأردن`
  ];

  for (const searchTerm of searchStrategies) {
    try {
      console.log(`🔍 Trying search: "${searchTerm}"`);
      
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ 
          address: searchTerm,
          componentRestrictions: { country: 'JO' }
        }, (results, status) => {
          if (status === 'OK' && results && results.length > 0) {
            resolve(results[0]);
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });

      console.log(`✅ Found school with: "${searchTerm}"`);
      return result;
    } catch (error) {
      console.warn(`⚠️ Search failed for "${searchTerm}"`);
      continue;
    }
  }

  throw new Error('Could not find school location');
}

// ====================================================================================================
// DRIVER LOGIN AND DASHBOARD
// ====================================================================================================
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
  console.log(`🚌 Driver ${username} logged in for school: ${schoolId}`);
  
  hideAllScreens();
  document.getElementById('driverDashboard').classList.remove('hidden');
  updateDriverDashboard(schoolId);
}

function updateDriverDashboard(schoolId) {
  const locationElement = document.getElementById('driverLocation');
  
  if (!locationElement) {
    console.error('❌ Driver location element not found');
    return;
  }
  
  locationElement.innerHTML = `
    <div style="text-align: left;">
      <strong>🚌 Driver Dashboard</strong><br>
      <strong>School ID:</strong> ${schoolId}<br><br>
      
      <button onclick="startBusSimulation('${schoolId}')" 
              style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin: 5px; cursor: pointer;">
        🎮 Start Bus Simulation
      </button>
      
      <button onclick="stopSimulation()" 
              style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin: 5px; cursor: pointer;">
        ⏹️ Stop Simulation
      </button>
      
      <button onclick="startRealTracking('${schoolId}')" 
              style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin: 5px; cursor: pointer;">
        📍 Use Real GPS
      </button>
      
      <div id="simulationStatus" style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
        <em>Ready to simulate bus movement</em>
      </div>
    </div>
  `;
}

// ====================================================================================================
// BUS SIMULATION FUNCTIONS
// ====================================================================================================
function startBusSimulation(schoolId) {
  if (isSimulating) {
    console.log('⚠️ Simulation already running');
    return;
  }

  const homeLocation = JSON.parse(localStorage.getItem('homeLocation') || '{"lat": 32.0155398, "lng": 35.8839243}');
  
  const simulationRoute = [
    { lat: homeLocation.lat + 0.01, lng: homeLocation.lng - 0.01, name: "🏫 Leaving School", delay: 2000 },
    { lat: homeLocation.lat + 0.008, lng: homeLocation.lng - 0.008, name: "🛣️ Main Street", delay: 3000 },
    { lat: homeLocation.lat + 0.006, lng: homeLocation.lng - 0.006, name: "🚦 Traffic Light", delay: 4000 },
    { lat: homeLocation.lat + 0.004, lng: homeLocation.lng - 0.004, name: "🏪 Shopping Area", delay: 3000 },
    { lat: homeLocation.lat + 0.002, lng: homeLocation.lng - 0.002, name: "🏠 Neighborhood", delay: 3000 },
    { lat: homeLocation.lat, lng: homeLocation.lng, name: "🏁 Arrived at Home", delay: 2000 }
  ];

  let currentIndex = 0;
  isSimulating = true;

  console.log('🎮 Starting bus simulation...');
  updateSimulationStatus('🎮 Simulation Started - Bus leaving school...');

  function moveToNextPoint() {
    if (currentIndex >= simulationRoute.length || !isSimulating) {
      console.log('🏁 Simulation complete');
      updateSimulationStatus('🏁 Simulation Complete');
      isSimulating = false;
      return;
    }

    const point = simulationRoute[currentIndex];
    console.log(`🚌 Moving to: ${point.name}`);
    updateSimulationStatus(`🚌 ${point.name}`);

    fetch('http://localhost:5000/track/driver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        schoolId: schoolId, 
        lat: point.lat, 
        lng: point.lng 
      })
    })
    .then(response => {
      if (response.ok) {
        updateSimulationStatus(`✅ ${point.name} - Location sent`);
      }
    })
    .catch(err => {
      console.error('❌ Failed to send location:', err);
    });

    currentIndex++;
    simulationInterval = setTimeout(moveToNextPoint, point.delay);
  }

  moveToNextPoint();
}

function stopSimulation() {
  if (simulationInterval) {
    clearTimeout(simulationInterval);
    simulationInterval = null;
  }
  if (driverTrackingInterval) {
    clearInterval(driverTrackingInterval);
    driverTrackingInterval = null;
  }
  
  isSimulating = false;
  console.log('🛑 Simulation stopped');
  updateSimulationStatus('🛑 Simulation Stopped');
}

function startRealTracking(schoolId) {
  stopSimulation();
  
  if (!navigator.geolocation) {
    alert("Geolocation not supported by your browser.");
    return;
  }

  console.log('📍 Starting real GPS tracking...');
  updateSimulationStatus('📍 Real GPS tracking activated');

  driverTrackingInterval = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        sendDriverLocation(schoolId, latitude, longitude);
        updateSimulationStatus(`📍 Real GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      },
      error => console.error('❌ Geolocation error:', error),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );
  }, 3000);
}

function updateSimulationStatus(message) {
  const statusElement = document.getElementById('simulationStatus');
  if (statusElement) {
    statusElement.innerHTML = `<em>${message}</em><br><small>Last update: ${new Date().toLocaleTimeString()}</small>`;
  }
}

function sendDriverLocation(schoolId, latitude, longitude) {
  fetch('http://localhost:5000/track/driver', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId, lat: latitude, lng: longitude })
  })
  .then(response => {
    if (response.ok) {
      console.log('✅ Driver location sent successfully');
    }
  })
  .catch(err => {
    console.error("❌ Failed to send driver location:", err);
  });
}

// ====================================================================================================
// UTILITY FUNCTIONS
// ====================================================================================================
function startLocationSharing() {
  if (navigator.geolocation && !locationSharing) {
    locationWatchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude: lat, longitude: lng } = position.coords;
        localStorage.setItem('currentLocation', JSON.stringify({ lat, lng, timestamp: Date.now() }));
        console.log(`📍 Student location updated: ${lat}, ${lng}`);
      },
      error => console.error('❌ Location tracking error:', error),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    );
    locationSharing = true;
    console.log('📍 Student location sharing started');
  }
}

function stopLocationSharing() {
  if (locationWatchId) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
    console.log('📍 Location sharing stopped');
  }
  if (driverTrackingInterval) {
    clearInterval(driverTrackingInterval);
    driverTrackingInterval = null;
  }
  locationSharing = false;
}

function clearIntervals() {
  if (busPollInterval) {
    clearInterval(busPollInterval);
    busPollInterval = null;
    console.log('🔄 Bus polling stopped');
  }
}

function logout() {
  console.log('🚪 Logging out...');
  stopSimulation();
  localStorage.clear();
  stopLocationSharing();
  clearIntervals();
  showMainScreen();
}

// ====================================================================================================
// GLOBAL FUNCTION EXPORTS (for onclick handlers in dashboard)
// ====================================================================================================
window.startBusSimulation = startBusSimulation;
window.stopSimulation = stopSimulation;
window.startRealTracking = startRealTracking;

// ====================================================================================================
// PAGE INITIALIZATION
// ====================================================================================================
// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Also initialize when Google Maps loads (if it loads after DOM)
window.initializeApp = initializeApp;