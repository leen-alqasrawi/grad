let locationSharing = false;
let driverTrackingInterval = null;
let locationWatchId = null;
let busPollInterval = null;
let directionsRenderer, directionsService, map;

function showMainScreen() {
  hideAllScreens();
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

function showMap() {
  hideAllScreens();
  document.getElementById('mapScreen').classList.remove('hidden');

  const school = JSON.parse(localStorage.getItem('schoolData'));
  const homeLocation = JSON.parse(localStorage.getItem('homeLocation'));
  const schoolName = `مدرسة ${school.name}`;

  document.getElementById('schoolLocation').textContent = school.name;
  document.getElementById('homeLocation').textContent = `Lat: ${homeLocation.lat.toFixed(4)}, Lng: ${homeLocation.lng.toFixed(4)}`;

  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address: schoolName }, (results, status) => {
    if (status === 'OK' && results[0]) {
      const schoolLatLng = results[0].geometry.location;
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
            destination: schoolLatLng,
            travelMode: google.maps.TravelMode.DRIVING
          }, (result, status) => {
            if (status === 'OK') directionsRenderer.setDirections(result);
          });

        } catch (err) {
          console.warn("Bus location unavailable or stale:", err.message);
          document.getElementById('busStatus').textContent = "Bus offline or out of range";
        }
      }, 10000);
    } else {
      console.error("Geocode error:", status);
      alert("Could not locate the school on the map.");
    }
  });

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
  }, 10000);
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
    driver1: { password: 'secret123', schoolId: 'SCH001' },
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
        }).catch(err => console.error("❌ Failed to send driver location:", err));
      },
      error => {
        console.error('🚨 Driver geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 10000
      }
    );
  }, 5000);

  document.getElementById('driverDashboard').classList.remove('hidden');
  document.getElementById('driverScreen').classList.add('hidden');
}

function stopLocationSharing() {
  if (locationWatchId) {
    navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = null;
    locationSharing = false;
  }
  if (driverTrackingInterval) {
    clearInterval(driverTrackingInterval);
    driverTrackingInterval = null;
  }
}

function clearIntervals() {
  if (busPollInterval) {
    clearInterval(busPollInterval);
    busPollInterval = null;
  }
}

function logout() {
  localStorage.clear();
  stopLocationSharing();
  clearIntervals();
  showMainScreen();
}

window.onload = showMainScreen;
