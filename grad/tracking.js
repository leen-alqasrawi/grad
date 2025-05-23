// tracking.js
let locationSharing = false;
let driverLocationSharing = false;
let locationWatchId = null;

const schools = {
  'SCH001': { name: 'Lincoln Elementary', lat: 40.7128, lng: -74.0060 },
  'SCH002': { name: 'Washington High School', lat: 40.7589, lng: -73.9851 },
  'SCH003': { name: 'Roosevelt Middle School', lat: 40.7505, lng: -73.9934 }
};

const driverCredentials = {
  'driver001': 'password123',
  'driver002': 'busdriver456'
};

function showMainScreen() {
  hideAllScreens();
  document.getElementById('mainScreen').classList.remove('hidden');
  stopLocationSharing();
}

function showStudentLogin() {
  hideAllScreens();
  document.getElementById('studentScreen').classList.remove('hidden');
}

function showDriverLogin() {
  hideAllScreens();
  document.getElementById('driverScreen').classList.remove('hidden');
}

function hideAllScreens() {
  const screens = ['mainScreen', 'studentScreen', 'driverScreen', 'mapScreen', 'driverDashboard'];
  screens.forEach(screen => {
    document.getElementById(screen).classList.add('hidden');
  });
}

function requestLocation() {
  const schoolId = document.getElementById('schoolId').value.trim();

  if (!schoolId || !schools[schoolId]) {
    alert('Please enter a valid School ID (e.g., SCH001)');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      localStorage.setItem('homeLocation', JSON.stringify({ lat, lng }));
      localStorage.setItem('schoolId', schoolId);
      showMap();
    },
    function(error) {
      alert('Location access denied. Please enable location services.');
    }
  );
}

let map, homeMarker, schoolMarker, busMarker;

function showMap() {
  hideAllScreens();
  document.getElementById('mapScreen').classList.remove('hidden');

  const schoolId = localStorage.getItem('schoolId');
  const school = schools[schoolId];
  const home = JSON.parse(localStorage.getItem('homeLocation'));

  document.getElementById('schoolLocation').textContent = school.name;
  document.getElementById('homeLocation').textContent = `Lat: ${home.lat.toFixed(4)}, Lng: ${home.lng.toFixed(4)}`;

  const center = {
    lat: (home.lat + school.lat) / 2,
    lng: (home.lng + school.lng) / 2
  };

  map = new google.maps.Map(document.getElementById('googleMap'), {
    zoom: 13,
    center
  });

  homeMarker = new google.maps.Marker({
    position: home,
    map,
    label: '🏠'
  });

  schoolMarker = new google.maps.Marker({
    position: { lat: school.lat, lng: school.lng },
    map,
    label: '🏫'
  });

  busMarker = new google.maps.Marker({
    position: { lat: school.lat, lng: school.lng },
    map,
    label: '🚌'
  });

  // Poll for live bus updates every 5 seconds
  setInterval(async () => {
    try {
      const response = await fetch(`http://localhost:5000/track/${schoolId}`);
      if (!response.ok) throw new Error('Bus data not found');
      const bus = await response.json();

      busMarker.setPosition({ lat: bus.lat, lng: bus.lng });

      document.getElementById('busStatus').textContent = 'Bus is on the move';
      document.getElementById('eta').textContent = 'Live tracking';
      document.getElementById('nextStop').textContent = `Lat: ${bus.lat.toFixed(4)}, Lng: ${bus.lng.toFixed(4)}`;
    } catch (err) {
      console.warn('No live bus location available');
    }
  }, 5000);
}


function driverLogin() {
  const username = document.getElementById('driverUsername').value.trim();
  const password = document.getElementById('driverPassword').value.trim();

  if (!username || !password || driverCredentials[username] !== password) {
    alert('Invalid credentials');
    return;
  }

  localStorage.setItem('driverLoggedIn', 'true');
  localStorage.setItem('driverUsername', username);
  localStorage.setItem('schoolId', 'SCH001'); // default for demo
  showDriverDashboard();
}

function showDriverDashboard() {
  hideAllScreens();
  document.getElementById('driverDashboard').classList.remove('hidden');
  startDriverLocationSharing();
}

function startDriverLocationSharing() {
  navigator.geolocation.watchPosition(
    async function(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const schoolId = localStorage.getItem('schoolId');

      await fetch('http://localhost:5000/track/driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId, lat, lng })
      });

      document.getElementById('driverLocation').innerHTML = `<strong>📍 Current Location:</strong> Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)} - <span style="color: green;">Active</span>`;
    },
    function(error) {
      console.error('Driver location error:', error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    }
  );
}

function logout() {
  localStorage.clear();
  showMainScreen();
}

window.onload = showMainScreen; 
