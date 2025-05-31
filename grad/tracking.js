let currentStudentData = null;
let currentDriverData = null;
let map = null;
let busMarker = null;
let homeMarker = null;
let schoolMarker = null;
let busLocationRef = null;
let isTracking = false;
let trackingInterval = null;
let directionsService = null;
let directionsRenderer = null;

function initializeApp() {
    console.log('Initializing School Bus Tracker...');
    setupEventListeners();
    initializeFirebase();
}

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
}

function setupEventListeners() {
    document.getElementById('trackBusBtn').addEventListener('click', showStudentLogin);
    document.getElementById('driverLoginLink').addEventListener('click', showDriverLogin);
    document.getElementById('continueBtn').addEventListener('click', startStudentTracking);
    document.getElementById('backToMainBtn').addEventListener('click', showMainScreen);
    document.getElementById('driverLoginBtn').addEventListener('click', handleDriverLogin);
    document.getElementById('backToMainBtn2').addEventListener('click', showMainScreen);
    document.getElementById('exitTrackingBtn').addEventListener('click', showMainScreen);
    document.getElementById('logoutBtn').addEventListener('click', showMainScreen);

    document.getElementById('studentId').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') startStudentTracking();
    });
    
    document.getElementById('driverPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleDriverLogin();
    });
}

async function startStudentTracking() {
    const studentId = document.getElementById('studentId').value.trim();
    
    if (!studentId) {
        alert('Please enter your student ID');
        return;
    }
    
    try {
        console.log('Fetching student data for ID:', studentId);
        
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
                    currentStudentData.school.coordinates = { lat: 32.0255, lng: 35.8939 };
                }
            }
        } catch (error) {
            console.error('Error fetching school coordinates:', error);
            currentStudentData.school.coordinates = { lat: 32.0255, lng: 35.8939 };
        }
        
        hideAllScreens();
        document.getElementById('mapScreen').classList.remove('hidden');
        
        setTimeout(() => {
            createMap();
            setupBusLocationListener();
        }, 100);
        
    } catch (error) {
        console.error('Error starting student tracking:', error);
        alert('Failed to start tracking. Please try again.');
    }
}

function handleDriverLogin() {
    const username = document.getElementById('driverUsername').value.trim();
    const password = document.getElementById('driverPassword').value.trim();
    
    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }
    
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
    
    hideAllScreens();
    document.getElementById('driverDashboard').classList.remove('hidden');
    setupDriverDashboard();
}

function createMap() {
    if (!currentStudentData || !currentStudentData.home) {
        console.error('No student data available for map');
        return;
    }
    
    const homeLocation = currentStudentData.home;
    const schoolLocation = currentStudentData.school.coordinates || { lat: 32.0255, lng: 35.8939 };
    
    console.log('Creating map with:', { home: homeLocation, school: schoolLocation });
    
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: homeLocation,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true
    });
    
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
        }
    });
    
    schoolMarker = new google.maps.Marker({
        position: schoolLocation,
        map: map,
        title: currentStudentData.school.name || "School",
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#EF4444',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3,
            scale: 12
        }
    });
    
    busMarker = new google.maps.Marker({
        map: map,
        title: "School Bus",
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#22C55E',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3,
            scale: 8
        },
        visible: false
    });
    
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(homeLocation);
    bounds.extend(schoolLocation);
    map.fitBounds(bounds);
    
    document.getElementById('schoolLocation').textContent = currentStudentData.school.name || "School";
    document.getElementById('homeLocation').textContent = `${homeLocation.lat.toFixed(4)}, ${homeLocation.lng.toFixed(4)}`;
    
    calculateRoute(schoolLocation, homeLocation);
}

function calculateRoute(origin, destination) {
    if (!directionsService || !directionsRenderer) return;
    
    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING
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

function setupBusLocationListener() {
    if (!currentStudentData || !currentStudentData.school) {
        console.error('No student data available');
        return;
    }
    
    const database = firebase.database();
    const schoolId = currentStudentData.school.school_id;
    
    console.log('Setting up listener for school:', schoolId);
    
    // Clean up any existing listener
    if (busLocationRef) {
        busLocationRef.off('value');
    }
    
    busLocationRef = database.ref(`bus-locations/${schoolId}`);
    
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
    
    busMarker.setPosition(busPosition);
    busMarker.setVisible(true);
    
    // Center map on bus with smooth animation
    map.panTo(busPosition);
    
    document.getElementById('busStatus').textContent = 'Bus is online';
    
    if (locationData.timestamp) {
        const lastUpdate = new Date(locationData.timestamp);
        const now = new Date();
        const ageInSeconds = Math.floor((now - lastUpdate) / 1000);
        
        let ageText;
        if (ageInSeconds < 60) {
            ageText = `${ageInSeconds} seconds ago`;
        } else {
            ageText = `${Math.floor(ageInSeconds / 60)} minutes ago`;
        }
        
        document.getElementById('busStatus').textContent = `Bus online (${ageText})`;
    }
    
    calculateETA(busPosition, currentStudentData.home);
}

function calculateETA(origin, destination) {
    if (!google.maps.DistanceMatrixService) return;
    
    const service = new google.maps.DistanceMatrixService();
    
    service.getDistanceMatrix({
        origins: [origin],
        destinations: [destination],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC
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
        
        <div id="driverStatus" style="margin-top: 20px; padding: 15px; background: #F3F4F6; border-radius: 8px;">
            <i class="fas fa-info-circle"></i> Ready to track
        </div>
        
        <div id="locationStats" style="margin-top: 20px; padding: 15px; background: #F9FAFB; border-radius: 8px; display: none;">
            <div style="font-weight: bold; margin-bottom: 10px;">Location Stats:</div>
            <div id="statsContent"></div>
        </div>
    `;
}

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
                
                document.getElementById('locationStats').style.display = 'block';
                document.getElementById('statsContent').innerHTML = `
                    <div>Latitude: ${lat.toFixed(6)}</div>
                    <div>Longitude: ${lng.toFixed(6)}</div>
                    <div>Accuracy: ${accuracy.toFixed(0)}m</div>
                    <div>Time: ${new Date().toLocaleTimeString()}</div>
                `;
                
            } catch (error) {
                console.error('Error sending location:', error);
                statusEl.innerHTML = `<i class="fas fa-times-circle" style="color: #EF4444;"></i> Error: ${error.message}`;
            }
        },
        (error) => {
            console.error('GPS error:', error);
            statusEl.innerHTML = `<i class="fas fa-times-circle" style="color: #EF4444;"></i> GPS error`;
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
}

function startLiveTracking() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }
    
    stopTracking();
    
    isTracking = true;
    let updateCount = 0;
    
    const statusEl = document.getElementById('driverStatus');
    statusEl.innerHTML = '<i class="fas fa-broadcast-tower" style="color: #F59E0B;"></i> Starting live tracking...';
    
    // Use interval for consistent updates
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
                
                // Create unique location data each time
                const locationData = {
                    lat: lat,
                    lng: lng,
                    accuracy: accuracy,
                    timestamp: Date.now(),
                    driverName: currentDriverData.username,
                    speed: position.coords.speed || 0,
                    heading: position.coords.heading || 0,
                    updateCount: updateCount,
                    // Add unique ID to force Firebase update
                    updateId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                };
                
                try {
                    const database = firebase.database();
                    
                    // Force update by removing then setting
                    await database.ref(`bus-locations/${currentDriverData.schoolId}`).remove();
                    await database.ref(`bus-locations/${currentDriverData.schoolId}`).set(locationData);
                    
                    statusEl.innerHTML = `<i class="fas fa-broadcast-tower" style="color: #22C55E;"></i> Live tracking (Update #${updateCount})`;
                    
                    document.getElementById('locationStats').style.display = 'block';
                    document.getElementById('statsContent').innerHTML = `
                        <div>Updates sent: ${updateCount}</div>
                        <div>Current accuracy: ${accuracy.toFixed(0)}m</div>
                        <div>Speed: ${position.coords.speed ? (position.coords.speed * 3.6).toFixed(1) + ' km/h' : 'N/A'}</div>
                        <div>Last update: ${new Date().toLocaleTimeString()}</div>
                        <div>Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
                    `;
                    
                    console.log(`Live update #${updateCount} sent:`, { lat, lng, timestamp: locationData.timestamp });
                } catch (error) {
                    console.error('Error in live tracking:', error);
                    statusEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #EF4444;"></i> Update error`;
                }
            },
            (error) => {
                console.error('GPS error in live tracking:', error);
                statusEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #EF4444;"></i> GPS error`;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }, 3000); // Update every 3 seconds
    
    console.log('Live tracking started');
}

function stopTracking() {
    console.log('Stopping tracking...');
    isTracking = false;
    
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

function showMainScreen() {
    hideAllScreens();
    document.getElementById('mainScreen').classList.remove('hidden');
    
    if (busLocationRef) {
        console.log('Removing Firebase listener');
        busLocationRef.off('value');
        busLocationRef = null;
    }
    
    stopTracking();
    
    currentStudentData = null;
    currentDriverData = null;
    map = null;
    busMarker = null;
    homeMarker = null;
    schoolMarker = null;
    directionsRenderer = null;
    directionsService = null;
    
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

window.sendCurrentLocation = sendCurrentLocation;
window.startLiveTracking = startLiveTracking;
window.stopTracking = stopTracking;
window.initializeApp = initializeApp;

console.log('Bus tracking system loaded successfully');