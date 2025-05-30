// Complete tracking.js with all fixes for real-time updates

// Global variables
let currentStudentData = null;
let currentDriverData = null;
let map = null;
let busMarker = null;
let homeMarker = null;
let schoolMarker = null;
let busLocationRef = null; // Store Firebase reference
let isTracking = false;
let trackingWatchId = null;
let trackingInterval = null;
let directionsService = null;
let directionsRenderer = null;

// Initialize the application
function initializeApp() {
    console.log('Initializing School Bus Tracker...');
    setupEventListeners();
    initializeFirebase();
}

// Initialize Firebase
function initializeFirebase() {
    const firebaseConfig = {
        apiKey: "AIzaSyAVyT8Xo9D65daMqvg4seqmlYlXOGwdvdE",
        authDomain: "signup-login-2b071.firebaseapp.com",
        databaseURL: "https://signup-login-2b071-default-rtdb.firebaseio.com",
        projectId: "signup-login-2b071",
        storageBucket: "signup-login-2b071.firebasestorage.app",
        messagingSenderId: "210147322194",
        appId: "1:210147322194:web:039e01003ec94cf07cb28b",
        measurementId: "G-M0NPF8P8S1"
    };

    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized');
    
    // Monitor connection status
    firebase.database().ref('.info/connected').on('value', (snapshot) => {
        if (snapshot.val() === true) {
            console.log('Connected to Firebase');
        } else {
            console.log('Disconnected from Firebase');
        }
    });
}

// Set up all event listeners
function setupEventListeners() {
    // Main screen
    document.getElementById('trackBusBtn').addEventListener('click', showStudentLogin);
    document.getElementById('driverLoginLink').addEventListener('click', showDriverLogin);
    
    // Student screen
    document.getElementById('continueBtn').addEventListener('click', startStudentTracking);
    document.getElementById('backToMainBtn').addEventListener('click', showMainScreen);
    
    // Driver screen
    document.getElementById('driverLoginBtn').addEventListener('click', handleDriverLogin);
    document.getElementById('backToMainBtn2').addEventListener('click', showMainScreen);
    
    // Map screen
    document.getElementById('exitTrackingBtn').addEventListener('click', showMainScreen);
    
    // Driver dashboard
    document.getElementById('logoutBtn').addEventListener('click', showMainScreen);
    
    // Enter key support
    document.getElementById('studentId').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startStudentTracking();
    });
    
    document.getElementById('driverPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleDriverLogin();
    });
}

// Start student tracking
async function startStudentTracking() {
    const studentId = document.getElementById('studentId').value.trim();
    
    if (!studentId) {
        alert('Please enter your student ID');
        return;
    }
    
    try {
        console.log('Fetching student data for ID:', studentId);
        
        // Fetch student and school data
        const response = await fetch(`http://localhost:5000/get-student-school?studentId=${studentId}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch student data');
        }
        
        const data = await response.json();
        
        if (!data || !data.school) {
            alert('Student not found or no school assigned');
            return;
        }
        
        currentStudentData = data;
        console.log('Student data loaded:', currentStudentData);
        
        // Try to fetch full school details including coordinates
        try {
            const schoolResponse = await fetch(`http://localhost:5000/school-info?name=${encodeURIComponent(data.school.name)}`);
            if (schoolResponse.ok) {
                const schoolData = await schoolResponse.json();
                
                if (schoolData.latitude && schoolData.longitude) {
                    currentStudentData.school.coordinates = {
                        lat: parseFloat(schoolData.latitude),
                        lng: parseFloat(schoolData.longitude)
                    };
                } else {
                    // Default coordinates if not in database
                    currentStudentData.school.coordinates = { lat: 32.0255, lng: 35.8939 };
                }
            }
        } catch (error) {
            console.error('Error fetching school coordinates:', error);
            // Use default coordinates
            currentStudentData.school.coordinates = { lat: 32.0255, lng: 35.8939 };
        }
        
        // Switch to map screen
        hideAllScreens();
        document.getElementById('mapScreen').classList.remove('hidden');
        
        // Initialize map and start tracking
        setTimeout(() => {
            createMap();
            setupBusLocationListener();
        }, 100);
        
    } catch (error) {
        console.error('Error starting student tracking:', error);
        alert('Failed to start tracking. Please try again.');
    }
}

// Handle driver login
function handleDriverLogin() {
    const username = document.getElementById('driverUsername').value.trim();
    const password = document.getElementById('driverPassword').value.trim();
    
    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }
    
    // Hardcoded drivers for demo (in production, validate against database)
    const drivers = {
        'driver1': { password: 'pass123', schoolId: 'SCH015' },
        'driver2': { password: 'pass456', schoolId: 'SCH002' }
    };
    
    const driver = drivers[username];
    
    if (!driver || driver.password !== password) {
        alert('Invalid username or password');
        return;
    }
    
    currentDriverData = { 
        username: username, 
        schoolId: driver.schoolId 
    };
    
    console.log('Driver logged in:', currentDriverData);
    
    // Switch to driver dashboard
    hideAllScreens();
    document.getElementById('driverDashboard').classList.remove('hidden');
    setupDriverDashboard();
}

// Create and initialize the map
function createMap() {
    if (!currentStudentData || !currentStudentData.home) {
        console.error('No student data available for map');
        return;
    }
    
    const homeLocation = currentStudentData.home;
    const schoolLocation = currentStudentData.school.coordinates || { lat: 32.0255, lng: 35.8939 };
    
    console.log('Creating map with:', { home: homeLocation, school: schoolLocation });
    
    // Initialize map
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: homeLocation,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true
    });
    
    // Initialize directions service
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: '#007BFF',
            strokeOpacity: 0.6,
            strokeWeight: 4
        }
    });
    
    // Home marker with custom icon
    homeMarker = new google.maps.Marker({
        position: homeLocation,
        map: map,
        title: "Your Home",
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#3B82F6',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3,
            scale: 10
        },
        zIndex: 100
    });
    
    // School marker with custom icon
    schoolMarker = new google.maps.Marker({
        position: schoolLocation,
        map: map,
        title: currentStudentData.school.name || "School",
        icon: {
            path: 'M12 2L2 7v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7l-10-5z',
            fillColor: '#EF4444',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 1.5,
            anchor: new google.maps.Point(12, 12)
        },
        zIndex: 100
    });
    
    // Bus marker (initially hidden)
    busMarker = new google.maps.Marker({
        map: map,
        title: "School Bus",
        icon: {
            path: 'M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z',
            fillColor: '#22C55E',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 1.5,
            anchor: new google.maps.Point(12, 12)
        },
        visible: false,
        zIndex: 150
    });
    
    // Add info windows
    const homeInfoWindow = new google.maps.InfoWindow({
        content: '<div style="padding: 8px;"><strong>Your Home</strong></div>'
    });
    
    const schoolInfoWindow = new google.maps.InfoWindow({
        content: `<div style="padding: 8px;"><strong>${currentStudentData.school.name || 'School'}</strong></div>`
    });
    
    homeMarker.addListener('click', () => {
        homeInfoWindow.open(map, homeMarker);
    });
    
    schoolMarker.addListener('click', () => {
        schoolInfoWindow.open(map, schoolMarker);
    });
    
    // Fit map to show both locations
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(homeLocation);
    bounds.extend(schoolLocation);
    map.fitBounds(bounds);
    
    // Add some padding
    map.panBy(0, -50);
    
    // Update UI with location info
    document.getElementById('schoolLocation').textContent = currentStudentData.school.name || "School";
    document.getElementById('homeLocation').textContent = `${homeLocation.lat.toFixed(4)}, ${homeLocation.lng.toFixed(4)}`;
    
    // Draw route between school and home
    calculateRoute(schoolLocation, homeLocation);
}

// Calculate and display route
function calculateRoute(origin, destination) {
    if (!directionsService || !directionsRenderer) return;
    
    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
    };
    
    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            console.log('Route calculated successfully');
        } else {
            console.error('Directions request failed:', status);
        }
    });
}

// Set up Firebase listener for bus location updates
function setupBusLocationListener() {
    if (!currentStudentData || !currentStudentData.school) {
        console.error('No student data available');
        return;
    }
    
    const database = firebase.database();
    const schoolId = currentStudentData.school.school_id;
    
    console.log('Setting up listener for school:', schoolId);
    
    // Store the reference
    busLocationRef = database.ref(`bus-locations/${schoolId}`);
    
    // Set up the listener
    busLocationRef.on('value', (snapshot) => {
        const locationData = snapshot.val();
        console.log('Received bus location update:', locationData);
        
        if (locationData && locationData.lat && locationData.lng) {
            updateBusOnMap(locationData);
        } else {
            console.log('No bus data available');
            document.getElementById('busStatus').textContent = 'Bus offline';
            document.getElementById('eta').textContent = 'N/A';
            document.getElementById('nextStop').textContent = 'N/A';
            
            if (busMarker) {
                busMarker.setVisible(false);
            }
        }
    }, (error) => {
        console.error('Firebase listener error:', error);
        document.getElementById('busStatus').textContent = 'Connection error';
    });
}

// Update bus position on map
function updateBusOnMap(locationData) {
    if (!map || !busMarker) {
        console.error('Map or bus marker not initialized');
        return;
    }
    
    const busPosition = { 
        lat: parseFloat(locationData.lat), 
        lng: parseFloat(locationData.lng) 
    };
    
    console.log('Updating bus position to:', busPosition);
    
    // Update marker position
    busMarker.setPosition(busPosition);
    busMarker.setVisible(true);
    
    // Optional: Smooth panning to bus location
    if (document.getElementById('mapScreen').classList.contains('hidden') === false) {
        map.panTo(busPosition);
    }
    
    // Update status UI
    document.getElementById('busStatus').textContent = 'Bus is online';
    
    // Calculate time since last update
    if (locationData.timestamp) {
        const lastUpdate = new Date(locationData.timestamp);
        const now = new Date();
        const ageInSeconds = Math.floor((now - lastUpdate) / 1000);
        
        let ageText;
        if (ageInSeconds < 60) {
            ageText = `${ageInSeconds} seconds ago`;
        } else if (ageInSeconds < 3600) {
            ageText = `${Math.floor(ageInSeconds / 60)} minutes ago`;
        } else {
            ageText = lastUpdate.toLocaleTimeString();
        }
        
        document.getElementById('busStatus').textContent = `Bus online (${ageText})`;
    }
    
    // Calculate ETA to home
    calculateETA(busPosition, currentStudentData.home);
}

// Calculate ETA from bus to home
function calculateETA(origin, destination) {
    if (!google.maps.DistanceMatrixService) return;
    
    const service = new google.maps.DistanceMatrixService();
    
    service.getDistanceMatrix({
        origins: [origin],
        destinations: [destination],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
    }, (response, status) => {
        if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
            const element = response.rows[0].elements[0];
            const duration = element.duration.text;
            const distance = element.distance.text;
            
            document.getElementById('eta').textContent = `${duration} (${distance})`;
            document.getElementById('nextStop').textContent = 'En route to your stop';
        } else {
            document.getElementById('eta').textContent = 'Calculating...';
        }
    });
}

// Set up driver dashboard
function setupDriverDashboard() {
    document.getElementById('driverLocation').innerHTML = `
        <div class="status-item">
            <span class="status-label"><i class="fas fa-id-badge"></i> Driver:</span>
            <span class="status-value">${currentDriverData.username}</span>
        </div>
        <div class="status-item">
            <span class="status-label"><i class="fas fa-school"></i> School ID:</span>
            <span class="status-value">${currentDriverData.schoolId}</span>
        </div>
        
        <div style="margin-top: 20px;">
            <button class="btn" onclick="sendCurrentLocation()" style="margin: 5px; background: #22C55E;">
                <i class="fas fa-location-arrow"></i> Send Location Once
            </button>
            <button class="btn" onclick="startLiveTracking()" style="margin: 5px; background: #F59E0B;">
                <i class="fas fa-broadcast-tower"></i> Start Live Tracking
            </button>
            <button class="btn secondary" onclick="stopTracking()" style="margin: 5px;">
                <i class="fas fa-stop"></i> Stop Tracking
            </button>
        </div>
        
        <div id="driverStatus" style="margin-top: 20px; padding: 15px; background: #F3F4F6; border-radius: 8px; font-family: monospace;">
            <i class="fas fa-info-circle"></i> Ready to track
        </div>
        
        <div id="locationStats" style="margin-top: 20px; padding: 15px; background: #F9FAFB; border-radius: 8px; display: none;">
            <div style="font-weight: bold; margin-bottom: 10px;">Location Stats:</div>
            <div id="statsContent"></div>
        </div>
    `;
}

// Send current location (one-time)
function sendCurrentLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }
    
    const statusEl = document.getElementById('driverStatus');
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting GPS location...';
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            console.log('Got GPS position:', { lat, lng, accuracy });
            
            if (accuracy > 100) {
                statusEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #F59E0B;"></i> GPS accuracy too low: ${accuracy.toFixed(0)}m. Try again outside.`;
                return;
            }
            
            const locationData = {
                lat: lat,
                lng: lng,
                accuracy: accuracy,
                timestamp: Date.now(),
                driverName: currentDriverData.username,
                speed: position.coords.speed || 0,
                heading: position.coords.heading || 0
            };
            
            try {
                console.log('Sending location to Firebase:', locationData);
                const database = firebase.database();
                await database.ref(`bus-locations/${currentDriverData.schoolId}`).set(locationData);
                
                statusEl.innerHTML = `<i class="fas fa-check-circle" style="color: #22C55E;"></i> Location sent successfully!`;
                
                // Show location stats
                document.getElementById('locationStats').style.display = 'block';
                document.getElementById('statsContent').innerHTML = `
                    <div>Latitude: ${lat.toFixed(6)}</div>
                    <div>Longitude: ${lng.toFixed(6)}</div>
                    <div>Accuracy: ${accuracy.toFixed(0)}m</div>
                    <div>Time: ${new Date().toLocaleTimeString()}</div>
                `;
                
                // Verify the data was written
                const snapshot = await database.ref(`bus-locations/${currentDriverData.schoolId}`).once('value');
                console.log('Verified data in Firebase:', snapshot.val());
                
            } catch (error) {
                console.error('Error sending location:', error);
                statusEl.innerHTML = `<i class="fas fa-times-circle" style="color: #EF4444;"></i> Error: ${error.message}`;
            }
        },
        (error) => {
            console.error('GPS error:', error);
            let errorMessage = 'GPS error';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location permission denied';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location unavailable';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out';
                    break;
            }
            
            statusEl.innerHTML = `<i class="fas fa-times-circle" style="color: #EF4444;"></i> ${errorMessage}`;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Start continuous live tracking
function startLiveTracking() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }
    
    // Stop any existing tracking
    stopTracking();
    
    isTracking = true;
    let updateCount = 0;
    
    const statusEl = document.getElementById('driverStatus');
    statusEl.innerHTML = '<i class="fas fa-broadcast-tower" style="color: #F59E0B;"></i> Starting live tracking...';
    
    // Use interval for reliable updates
    trackingInterval = setInterval(() => {
        if (!isTracking) {
            clearInterval(trackingInterval);
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                updateCount++;
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                
                // Only send if accuracy is good
                if (accuracy <= 100) {
                    const locationData = {
                        lat: lat,
                        lng: lng,
                        accuracy: accuracy,
                        timestamp: Date.now(),
                        driverName: currentDriverData.username,
                        speed: position.coords.speed || 0,
                        heading: position.coords.heading || 0,
                        updateCount: updateCount
                    };
                    
                    try {
                        const database = firebase.database();
                        await database.ref(`bus-locations/${currentDriverData.schoolId}`).set(locationData);
                        
                        statusEl.innerHTML = `<i class="fas fa-broadcast-tower" style="color: #22C55E;"></i> Live tracking (Update #${updateCount})`;
                        
                        // Update stats
                        document.getElementById('locationStats').style.display = 'block';
                        document.getElementById('statsContent').innerHTML = `
                            <div>Updates sent: ${updateCount}</div>
                            <div>Current accuracy: ${accuracy.toFixed(0)}m</div>
                            <div>Speed: ${position.coords.speed ? (position.coords.speed * 3.6).toFixed(1) + ' km/h' : 'N/A'}</div>
                            <div>Last update: ${new Date().toLocaleTimeString()}</div>
                        `;
                        
                        console.log(`Live update #${updateCount} sent`);
                    } catch (error) {
                        console.error('Error in live tracking:', error);
                        statusEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #EF4444;"></i> Update error`;
                    }
                } else {
                    statusEl.innerHTML = `<i class="fas fa-satellite-dish" style="color: #F59E0B;"></i> Waiting for better GPS (${accuracy.toFixed(0)}m)`;
                }
            },
            (error) => {
                console.error('GPS error in live tracking:', error);
                statusEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #EF4444;"></i> GPS error`;
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    }, 5000); // Update every 5 seconds
    
    console.log('Live tracking started');
}

// Stop tracking
function stopTracking() {
    console.log('Stopping tracking...');
    isTracking = false;
    
    // Clear watch position if exists
    if (trackingWatchId !== null) {
        navigator.geolocation.clearWatch(trackingWatchId);
        trackingWatchId = null;
    }
    
    // Clear interval if exists
    if (trackingInterval !== null) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }
    
    const statusEl = document.getElementById('driverStatus');
    if (statusEl) {
        statusEl.innerHTML = '<i class="fas fa-stop-circle"></i> Tracking stopped';
    }
    
    console.log('Tracking stopped');
}

// Navigation functions
function showMainScreen() {
    hideAllScreens();
    document.getElementById('mainScreen').classList.remove('hidden');
    
    // Clean up Firebase listener
    if (busLocationRef) {
        console.log('Removing Firebase listener');
        busLocationRef.off('value');
        busLocationRef = null;
    }
    
    // Stop any tracking
    stopTracking();
    
    // Reset all state
    currentStudentData = null;
    currentDriverData = null;
    map = null;
    busMarker = null;
    homeMarker = null;
    schoolMarker = null;
    directionsRenderer = null;
    directionsService = null;
    
    // Clear input fields
    document.getElementById('studentId').value = '';
    document.getElementById('driverUsername').value = '';
    document.getElementById('driverPassword').value = '';
}

function showStudentLogin() {
    hideAllScreens();
    document.getElementById('studentScreen').classList.remove('hidden');
    document.getElementById('studentId').focus();
}

function showDriverLogin() {
    hideAllScreens();
    document.getElementById('driverScreen').classList.remove('hidden');
    document.getElementById('driverUsername').focus();
}

function hideAllScreens() {
    const screens = ['mainScreen', 'studentScreen', 'driverScreen', 'mapScreen', 'driverDashboard'];
    screens.forEach(screen => {
        const element = document.getElementById(screen);
        if (element) {
            element.classList.add('hidden');
        }
    });
}

// Utility functions
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Distance in meters
}

// Make functions available globally for onclick handlers
window.sendCurrentLocation = sendCurrentLocation;
window.startLiveTracking = startLiveTracking;
window.stopTracking = stopTracking;
window.initializeApp = initializeApp;

// Log when script loads
console.log('Bus tracking system loaded successfully');
//student_KuI92bwRYIg8obHBlPVk5LTAj342_1748201740877