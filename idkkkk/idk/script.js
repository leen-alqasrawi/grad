let map;
let marker;

function initMap() {
  const defaultLocation = { lat: 25.276987, lng: 55.296249 }; // Default to Dubai

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 14,
    center: defaultLocation,
  });

  marker = new google.maps.Marker({
    position: defaultLocation,
    map: map,
    title: "Bus Location",
  });
}

function trackBus() {
  if (!map || !marker) {
    alert("Map is still loading, please wait...");
    return;
  }

  const accountId = document.getElementById("account_id").value.trim();
  if (!accountId) {
    alert("Please enter your Account ID before tracking.");
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (position) => {
        const currentLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        marker.setPosition(currentLocation);
        map.setCenter(currentLocation);
      },
      (error) => {
        alert("Unable to retrieve your location.");
        console.error(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      }
    );
  } else {
    alert("Geolocation is not supported by your browser.");
  }
}

// Wait for everything to load
window.onload = function () {
  if (typeof google === 'object' && typeof google.maps === 'object') {
    initMap();
  } else {
    console.error("Google Maps API not loaded.");
  }
};
document.getElementById("contactForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const message = document.getElementById("message").value.trim();
  const successMsg = document.getElementById("successMsg");

  if (name === "" || email === "" || message === "") {
    alert("Please fill out all required fields.");
    return;
  }

  // Simulate sending...
  successMsg.style.display = "block";

  // Reset form
  setTimeout(() => {
    this.reset();
    successMsg.style.display = "none";
  }, 3000);
});
// Sample data — you can replace with your real schools
const schools = [
  {
    name: "Al Noor International School",
    state: "Capital",
    county: "University",
    city: "Shafa Badran"
  },
  {
    name: "Al Jazeera Private Academy",
    state: "Capital",
    county: "Downtown",
    city: "Abdoun"
  },
  {
    name: "Future Leaders School",
    state: "Zarqa",
    county: "West",
    city: "Ruseifa"
  },
  {
    name: "Modern Knowledge School",
    state: "Irbid",
    county: "University",
    city: "Tlaa Al-Ali"
  },
  {
    name: "Smart Horizons Academy",
    state: "Capital",
    county: "University",
    city: "Shafa Badran"
  }
];

// Dropdown options
const states = ["Capital", "Irbid", "Zarqa"];
const counties = ["University", "Downtown", "West"];
const cities = ["Shafa Badran", "Abdoun", "Ruseifa", "Tlaa Al-Ali"];

window.onload = function () {
  populateSelect("state", states);
  populateSelect("county", counties);
  populateSelect("city", cities);
  displaySchools(schools); // Show all on load
};

function populateSelect(id, items) {
  const select = document.getElementById(id);
  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
}

function filterSchools() {
  const state = document.getElementById("state").value;
  const county = document.getElementById("county").value;
  const city = document.getElementById("city").value;

  const filtered = schools.filter(s =>
    (!state || s.state === state) &&
    (!county || s.county === county) &&
    (!city || s.city === city)
  );

  displaySchools(filtered);
}

function displaySchools(list) {
  const container = document.getElementById("schoolsList");
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `<p class="no-results">No schools found. Please refine your search.</p>`;
    return;
  }

  list.forEach(school => {
    const card = document.createElement("div");
    card.className = "school-card";
    card.innerHTML = `
      <h3>${school.name}</h3>
      <p><strong>State:</strong> ${school.state}</p>
      <p><strong>County:</strong> ${school.county}</p>
      <p><strong>City:</strong> ${school.city}</p>
    `;
    container.appendChild(card);
  });
}
const params = new URLSearchParams(window.location.search);
const schoolName = params.get("school");

window.open('https://www.google.com/maps?q=31.963158,35.930359', '_blank');
