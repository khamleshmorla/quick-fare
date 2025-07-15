const GOOGLE_MAPS_API_KEY = "AIzaSyBOKVVzgoFcK7gDj0lane0wTDgsvpCWAAY";  // Replace with your Google Maps API Key

// Function to fetch and display fares
function fetchFares() {
    const pickup = document.getElementById("pickup").value;
    const drop = document.getElementById("drop").value;
    const rideType = document.getElementById("rideType").value;
    const resultsDiv = document.getElementById("results");

    if (!pickup || !drop) {
        alert("Please enter both pickup and drop locations.");
        return;
    }

    // Show loading animation
    resultsDiv.innerHTML = `
        <div class="text-center text-white text-lg animate-pulse">
            Fetching fares... 🚕💨
        </div>
    `;

    let services;

    if (rideType === "bike") {
        services = [
            { service: "🏍️ Rapido Bike", minFare: 50, maxFare: 120 },
            { service: "🚴 Ola Bike", minFare: 60, maxFare: 130 },
            { service: "🏍️ Uber Moto", minFare: 70, maxFare: 140 }
        ];
    } else if (rideType === "auto") {
        services = [
            { service: "🚜 Ola Auto", minFare: 80, maxFare: 200 },
            { service: "🛺 Uber Auto", minFare: 90, maxFare: 220 }
        ];
    } else if (rideType === "car") {
        services = [
            { service: "🚗 Ola Mini", minFare: 150, maxFare: 350 },
            { service: "🚖 UberGo", minFare: 180, maxFare: 400 },
            { service: "🚙 Ola Sedan", minFare: 250, maxFare: 500 },
            { service: "🚘 Uber Premium", minFare: 300, maxFare: 550 }
        ];
    }

    // Fetch distance and time using Google Maps API
    fetchDistanceAndTime(pickup, drop, resultsDiv);

    // Simulate a delay to enhance UX
    setTimeout(() => {
        const fares = services.map(service => ({
            service: service.service,
            price: `₹${Math.floor(Math.random() * (service.maxFare - service.minFare + 1) + service.minFare)}`
        }));

        // Display fares in grid format
        resultsDiv.innerHTML = `
            <h2 class='text-xl font-bold text-white mb-3'>Fare Comparison 🚕</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        `;

        fares.forEach(ride => {
            resultsDiv.innerHTML += `
                <div class="p-4 bg-gray-800 text-white rounded-lg shadow-lg hover:scale-105 transition transform duration-300 ease-in-out">
                    <h3 class="text-lg font-semibold">${ride.service}</h3>
                    <p class="text-yellow-400 text-xl font-bold">${ride.price}</p>
                </div>
            `;
        });

        resultsDiv.innerHTML += `</div>`; // Close the grid div
    }, 1500);
}

// Function to fetch distance and time using Google Maps API
async function fetchDistanceAndTime(pickup, drop, resultsDiv) {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(pickup)}&destinations=${encodeURIComponent(drop)}&key=${GOOGLE_MAPS_API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === "OK" && data.rows.length > 0 && data.rows[0].elements.length > 0) {
            const element = data.rows[0].elements[0];
            const distanceText = element.distance.text; 
            const durationText = element.duration.text;

            resultsDiv.innerHTML = `
                <h3 class='text-xl font-bold text-white mb-3'>Distance and Time</h3>
                <p class='text-white'>Distance: ${distanceText}</p>
                <p class='text-white'>Estimated Time: ${durationText}</p>
            `;
        } else {
            resultsDiv.innerHTML = `
                <h3 class='text-xl font-bold text-white mb-3'>Error</h3>
                <p class='text-white'>Unable to fetch distance and time.</p>
            `;
        }
    } catch (error) {
        console.error("Error fetching distance:", error);
        resultsDiv.innerHTML = `
            <h3 class='text-xl font-bold text-white mb-3'>Error</h3>
            <p class='text-white'>Error fetching distance and time.</p>
        `;
    }
}

// Function to setup autocomplete for input fields
function setupAutocomplete(inputId, resultsId) {
    const input = document.getElementById(inputId);
    const resultsDiv = document.getElementById(resultsId);

    input.addEventListener("input", function() {
        let query = input.value.trim();
        if (query.length < 3) {
            resultsDiv.style.display = "none";
            return;
        }

        fetch(`https://api.locationiq.com/v1/autocomplete.php?key=${ACCESS_TOKEN}&q=${query}&limit=5&format=json`)
            .then(response => response.json())
            .then(data => {
                resultsDiv.innerHTML = "";
                if (!data || data.length === 0) {
                    resultsDiv.style.display = "none";
                    return;
                }

                data.forEach(location => {
                    let div = document.createElement("div");
                    div.textContent = location.display_name;
                    div.onclick = function() {
                        input.value = location.display_name;
                        resultsDiv.style.display = "none";
                    };
                    resultsDiv.appendChild(div);
                });

                resultsDiv.style.display = "block";
            })
            .catch(error => console.error("Error fetching location data:", error));
    });

    document.addEventListener("click", function(e) {
        if (!input.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.style.display = "none";
        }
    });
}

// Initialize autocomplete for pickup and drop locations
setupAutocomplete("pickup", "pickup-results");
setupAutocomplete("drop", "drop-results");
