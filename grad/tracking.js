// ✅ Revised tracking.js with dynamic school lookup via student ID

let locationSharing = false;
let driverLocationSharing = false;
let locationWatchId = null;

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
  screens.forEach(screen => document.getElementById(screen).classList.add('hidden'));
}

async function requestLocation() {
  const studentId = document.getElementById('studentId').value.trim();

  if (!studentId) {
    alert('Please enter your Student ID');
    return;
  }

  try {
    const res = await fetch(`http://localhost:5000/get-student-school?studentId=${studentId}`);
    const data = await res.json();

    if (!data || !data.school) {
      alert('Invalid Student ID or no school linked.');
      return;
    }

    const school = data.school;
    localStorage.setItem('schoolData', JSON.stringify(school));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          localStorage.setItem('homeLocation', JSON.stringify({ lat, lng }));
          showMap();
          startLocationSharing();
        },
        error => {
          alert('Location access denied. Please enable location services.');
          console.error('Geolocation error:', error);
        }
      );
    } else {
      alert('Geolocation not supported.');
    }
  } catch (error) {
    console.error('Error fetching school info:', error);
    alert('Failed to retrieve school info.');
  }
}

function showMap() {
  hideAllScreens();
  document.getElementById('mapScreen').classList.remove('hidden');

const school = JSON.parse(localStorage.getItem('schoolData'));
const schoolName = `مدرسة ${school["اسم المدرسة"]}`;
const mapQuery = encodeURIComponent(schoolName);

const geocoder = new google.maps.Geocoder();
geocoder.geocode({ address: schoolName }, (results, status) => {
  if (status === "OK" && results[0]) {
    const schoolLocation = results[0].geometry.location;
    document.getElementById('schoolLocation').textContent = school["اسم المدرسة"];
    document.getElementById('homeLocation').textContent = `Lat: ${homeLocation.lat.toFixed(4)}, Lng: ${homeLocation.lng.toFixed(4)}`;
    
    // optionally store lat/lng if needed later
    localStorage.setItem('schoolGeo', JSON.stringify({
      lat: schoolLocation.lat(),
      lng: schoolLocation.lng()
    }));
  } else {
    console.error("Geocode error:", status);
    alert("Could not locate the school on the map.");
  }
});

  const homeLocation = JSON.parse(localStorage.getItem('homeLocation'));

  document.getElementById('schoolLocation').textContent = school.name;
  document.getElementById('homeLocation').textContent = `Lat: ${homeLocation.lat.toFixed(4)}, Lng: ${homeLocation.lng.toFixed(4)}`;

  updateBusStatus();
}

function updateBusStatus() {
  const statuses = ['Bus is approaching your stop', 'Bus is 5 minutes away', 'Bus is on route', 'Bus has left the school'];
  const etas = ['5 minutes', '10 minutes', '15 minutes', '20 minutes'];
  const stops = ['Main Street', 'Oak Avenue', 'Elm Street', 'School Parking Lot'];

  setInterval(() => {
    document.getElementById('busStatus').textContent = statuses[Math.floor(Math.random() * statuses.length)];
    document.getElementById('eta').textContent = etas[Math.floor(Math.random() * etas.length)];
    document.getElementById('nextStop').textContent = stops[Math.floor(Math.random() * stops.length)];
  }, 5000);
}

function startLocationSharing() {
  if (navigator.geolocation) {
    locationWatchId = navigator.geolocation.watchPosition(
      position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        localStorage.setItem('currentLocation', JSON.stringify({ lat, lng, timestamp: Date.now() }));
      },
      error => console.error('Location tracking error:', error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
    locationSharing = true;
  }
}

function stopLocationSharing() {
  if (locationWatchId) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
    locationSharing = false;
  }
}

function logout() {
  localStorage.clear();
  stopLocationSharing();
  driverLocationSharing = false;
  showMainScreen();
}

window.onload = showMainScreen;
