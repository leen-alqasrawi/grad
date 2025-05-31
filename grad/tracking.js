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

    try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized successfully');
        
        const database = firebase.database();
        database.ref('.info/connected').on('value', function(snapshot) {
            if (snapshot.val() === true) {
                console.log('Firebase connected');
            } else {
                console.log('Firebase disconnected');
            }
        });
    } catch (error) {
        console.error('Firebase initialization failed:', error);
    }
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

    document.getElementById('studentId').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') startStudentTracking();
    });
    
    document.getElementById('driverPassword').addEventListener('keypress', function(e) {
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
        
        const response = await fetch('http://localhost:5000/api/schools/student-school?studentId=' + studentId);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 404) {
                alert('Student not found. Please check your student ID.');
                return;
            }
            throw new Error('Server error: ' + response.status);
        }
        
        const data = await response.json();
        console.log('Student data received:', data);
        
        if (!data || !data.school) {
            alert('Student not found or no school assigned');
            return;
        }
        
        currentStudentData = {
            studentId: studentId,
            school: {
                name: data.school.name,
                school_id: data.school.school_id,
                region: data.school.region,
                coordinates: { lat: 31.9454, lng: 35.9284 }
            },
            home: data.home
        };
        
        console.log('Student data processed:', currentStudentData);
        
        hideAllScreens();
        document.getElementById('mapScreen').classList.remove('hidden');
        
        setTimeout(function() {
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
    
    console.log('Driver login attempt:', username);
    
    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }
    
    const drivers = {
        'driver1': { password: 'pass123', schoolId: 'SCH015' },
        'driver2': { password: 'pass456', schoolId: 'SCH002' },
        'admin': { password: 'admin123', schoolId: 'SCH001' }
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
    const schoolLocation = currentStudentData.school.coordinates;
    
    console.log('Creating map with home:', homeLocation, 'school:', schoolLocation);
    
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
        title: currentStudentData.school.name,
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
    
    document.getElementById('schoolLocation').textContent = currentStudentData.school.name;
    document.getElementById('homeLocation').textContent = homeLocation.lat.toFixed(4) + ', ' + homeLocation.lng.toFixed(4);
    
    calculateRoute(schoolLocation, homeLocation);
    console.log('Map created successfully');
}

function calculateRoute(origin, destination) {
    if (!directionsService || !directionsRenderer) return;
    
    const request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.DRIVING
    };
    
    directionsService.route(request, function(result, status) {
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
        console.error('No student data available for bus listener');
        return;
    }
    
    const database = firebase.database();
    const schoolId = currentStudentData.school.school_id;
    
    console.log('Setting up bus location listener for school:', schoolId);
    
    if (busLocationRef) {
        console.log('Cleaning up existing listener');
        busLocationRef.off('value');
    }
    
    busLocationRef = database.ref('bus-locations/' + schoolId);
    console.log('Firebase reference created:', 'bus-locations/' + schoolId);
    
    busLocationRef.once('value')
        .then(function(snapshot) {
            console.log('Initial data check:', snapshot.val());
            if (!snapshot.exists()) {
                console.log('No data exists at this path yet');
            }
        })
        .catch(function(error) {
            console.error('Error reading initial data:', error);
        });
    
    busLocationRef.on('value', function(snapshot) {
        const locationData = snapshot.val();
        console.log('Bus location update received:', locationData);
        
        if (locationData && locationData.lat && locationData.lng) {
            console.log('Valid bus location data, updating map');
            updateBusOnMap(locationData);
        } else {
            console.log('No valid bus data available');
            document.getElementById('busStatus').textContent = 'Bus offline';
            document.getElementById('eta').textContent = 'N/A';
            document.getElementById('nextStop').textContent = 'N/A';
            
            if (busMarker) {
                busMarker.setVisible(false);
            }
        }
    }, function(error) {
        console.error('Firebase listener error:', error);
        document.getElementById('busStatus').textContent = 'Connection error: ' + error.message;
    });
    
    console.log('Bus location listener setup complete');
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
    
    map.panTo(busPosition);
    
    document.getElementById('busStatus').textContent = 'Bus is online';
    
    if (locationData.timestamp) {
        const lastUpdate = new Date(locationData.timestamp);
        const now = new Date();
        const ageInSeconds = Math.floor((now - lastUpdate) / 1000);
        
        let ageText;
        if (ageInSeconds < 60) {
            ageText = ageInSeconds + ' seconds ago';
        } else {
            ageText = Math.floor(ageInSeconds / 60) + ' minutes ago';
        }
        
        document.getElementById('busStatus').textContent = 'Bus online (' + ageText + ')';
    }
    
    calculateETA(busPosition, currentStudentData.home);
    console.log('Bus position updated on map');
}

function calculateETA(origin, destination) {
    if (!google.maps.DistanceMatrixService) return;
    
    const service = new google.maps.DistanceMatrixService();
    
    service.getDistanceMatrix({
        origins: [origin],
        destinations: [destination],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC
    }, function(response, status) {
        if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
            const element = response.rows[0].elements[0];
            const duration = element.duration.text;
            const distance = element.distance.text;
            
            document.getElementById('eta').textContent = duration + ' (' + distance + ')';
            document.getElementById('nextStop').textContent = 'En route to your stop';
            console.log('ETA calculated:', duration, distance);
        } else {
            document.getElementById('eta').textContent = 'Calculating...';
            console.log('ETA calculation failed:', status);
        }
    });
}

function setupDriverDashboard() {
    console.log('Setting up driver dashboard');
    
    const driverLocationDiv = document.getElementById('driverLocation');
    
    driverLocationDiv.innerHTML = '';
    
    // Create status items
    const statusItem1 = document.createElement('div');
    statusItem1.className = 'status-item';
    statusItem1.innerHTML = '<span class="status-label"><i class="fas fa-id-badge"></i> Driver:</span><span class="status-value">' + currentDriverData.username + '</span>';
    
    const statusItem2 = document.createElement('div');
    statusItem2.className = 'status-item';
    statusItem2.innerHTML = '<span class="status-label"><i class="fas fa-school"></i> School ID:</span><span class="status-value">' + currentDriverData.schoolId + '</span>';
    
    // Create buttons container
    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.marginTop = '20px';
    
    const sendBtn = document.createElement('button');
    sendBtn.className = 'btn';
    sendBtn.style.margin = '5px';
    sendBtn.style.background = '#22C55E';
    sendBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Send Location Once';
    sendBtn.onclick = sendCurrentLocation;
    
    const liveBtn = document.createElement('button');
    liveBtn.className = 'btn';
    liveBtn.style.margin = '5px';
    liveBtn.style.background = '#F59E0B';
    liveBtn.innerHTML = '<i class="fas fa-broadcast-tower"></i> Start Live Tracking';
    liveBtn.onclick = startLiveTracking;
    
    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn secondary';
    stopBtn.style.margin = '5px';
    stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Tracking';
    stopBtn.onclick = stopTracking;
    
    // Create status div
    const statusDiv = document.createElement('div');
    statusDiv.id = 'driverStatus';
    statusDiv.style.marginTop = '20px';
    statusDiv.style.padding = '15px';
    statusDiv.style.background = '#F3F4F6';
    statusDiv.style.borderRadius = '8px';
    statusDiv.innerHTML = '<i class="fas fa-info-circle"></i> Ready to track';
    
    // Create location stats div
    const statsDiv = document.createElement('div');
    statsDiv.id = 'locationStats';
    statsDiv.style.marginTop = '20px';
    statsDiv.style.padding = '15px';
    statsDiv.style.background = '#F9FAFB';
    statsDiv.style.borderRadius = '8px';
    statsDiv.style.display = 'none';
    
    const statsTitle = document.createElement('div');
    statsTitle.style.fontWeight = 'bold';
    statsTitle.style.marginBottom = '10px';
    statsTitle.textContent = 'Location Stats:';
    
    const statsContent = document.createElement('div');
    statsContent.id = 'statsContent';
    
    statsDiv.appendChild(statsTitle);
    statsDiv.appendChild(statsContent);
    
    buttonsDiv.appendChild(sendBtn);
    buttonsDiv.appendChild(liveBtn);
    buttonsDiv.appendChild(stopBtn);
    
    driverLocationDiv.appendChild(statusItem1);
    driverLocationDiv.appendChild(statusItem2);
    driverLocationDiv.appendChild(buttonsDiv);
    driverLocationDiv.appendChild(statusDiv);
    driverLocationDiv.appendChild(statsDiv);
}

function sendCurrentLocation() {
    console.log('Attempting to send current location');
    
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }
    
    const statusEl = document.getElementById('driverStatus');
    statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting GPS location...';
    
    navigator.geolocation.getCurrentPosition(
        async function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            console.log('Got GPS position:', { lat: lat, lng: lng, accuracy: accuracy });
            
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
                console.log('Firebase path:', 'bus-locations/' + currentDriverData.schoolId);
                
                const database = firebase.database();
                await database.ref('bus-locations/' + currentDriverData.schoolId).set(locationData);
                
                console.log('Location sent successfully to Firebase');
                statusEl.innerHTML = '<i class="fas fa-check-circle" style="color: #22C55E;"></i> Location sent successfully!';
                
                const statsDiv = document.getElementById('locationStats');
                const statsContent = document.getElementById('statsContent');
                
                statsDiv.style.display = 'block';
                statsContent.innerHTML = 
                    '<div>Latitude: ' + lat.toFixed(6) + '</div>' +
                    '<div>Longitude: ' + lng.toFixed(6) + '</div>' +
                    '<div>Accuracy: ' + accuracy.toFixed(0) + 'm</div>' +
                    '<div>Time: ' + new Date().toLocaleTimeString() + '</div>' +
                    '<div>Firebase Path: bus-locations/' + currentDriverData.schoolId + '</div>';
                
            } catch (error) {
                console.error('Error sending location to Firebase:', error);
                statusEl.innerHTML = '<i class="fas fa-times-circle" style="color: #EF4444;"></i> Error: ' + error.message;
            }
        },
        function(error) {
            console.error('GPS error:', error);
            statusEl.innerHTML = '<i class="fas fa-times-circle" style="color: #EF4444;"></i> GPS error: ' + error.message;
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
}

function startLiveTracking() {
    console.log('Starting live tracking');
    
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }
    
    stopTracking();
    
    isTracking = true;
    let updateCount = 0;
    
    const statusEl = document.getElementById('driverStatus');
    statusEl.innerHTML = '<i class="fas fa-broadcast-tower" style="color: #F59E0B;"></i> Starting live tracking...';
    
    trackingInterval = setInterval(function() {
        if (!isTracking) {
            clearInterval(trackingInterval);
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            async function(position) {
                updateCount++;
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                
                const locationData = {
                    lat: lat,
                    lng: lng,
                    accuracy: accuracy,
                    timestamp: Date.now(),
                    driverName: currentDriverData.username,
                    speed: position.coords.speed || 0,
                    heading: position.coords.heading || 0,
                    updateCount: updateCount,
                    updateId: Date.now() + '_' + Math.random().toString(36).substr(2, 9)
                };
                
                try {
                    const database = firebase.database();
                    await database.ref('bus-locations/' + currentDriverData.schoolId).set(locationData);
                    
                    console.log('Live update #' + updateCount + ' sent:', { lat: lat, lng: lng, timestamp: locationData.timestamp });
                    
                    statusEl.innerHTML = '<i class="fas fa-broadcast-tower" style="color: #22C55E;"></i> Live tracking (Update #' + updateCount + ')';
                    
                    const statsDiv = document.getElementById('locationStats');
                    const statsContent = document.getElementById('statsContent');
                    
                    statsDiv.style.display = 'block';
                    statsContent.innerHTML = 
                        '<div>Updates sent: ' + updateCount + '</div>' +
                        '<div>Current accuracy: ' + accuracy.toFixed(0) + 'm</div>' +
                        '<div>Speed: ' + (position.coords.speed ? (position.coords.speed * 3.6).toFixed(1) + ' km/h' : 'N/A') + '</div>' +
                        '<div>Last update: ' + new Date().toLocaleTimeString() + '</div>' +
                        '<div>Coordinates: ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</div>' +
                        '<div>Firebase Path: bus-locations/' + currentDriverData.schoolId + '</div>';
                    
                } catch (error) {
                    console.error('Error in live tracking:', error);
                    statusEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #EF4444;"></i> Update error: ' + error.message;
                }
            },
            function(error) {
                console.error('GPS error in live tracking:', error);
                statusEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #EF4444;"></i> GPS error: ' + error.message;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }, 3000);
    
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
    screens.forEach(function(screen) {
        const element = document.getElementById(screen);
        if (element) {
            element.classList.add('hidden');
        }
    });
}

// Make functions available globally
window.sendCurrentLocation = sendCurrentLocation;
window.startLiveTracking = startLiveTracking;
window.stopTracking = stopTracking;
window.initializeApp = initializeApp;

console.log('Bus tracking system loaded successfully');