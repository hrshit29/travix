document.addEventListener('DOMContentLoaded', () => {
    // Firebase configuration from your project
    const firebaseConfig = {
      apiKey: "AIzaSyCKrnpS3Uwb2_VoI7G0CB1UEW9R-7crxh0",
      authDomain: "travix-c3209.firebaseapp.com",
      projectId: "travix-c3209",
      storageBucket: "travix-c3209.firebasestorage.app",
      messagingSenderId: "352909773507",
      appId: "1:352909773507:web:e01e01dd98edfcb9a6f076",
      measurementId: "G-YXJXYQ6V3B"
    };
    
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // UI Elements
    const authContainer = document.getElementById('auth-container');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const toggleLink = document.getElementById('toggle-link');
    const toggleText = document.getElementById('toggle-text');
    const authError = document.getElementById('auth-error');
    const logoutBtn = document.getElementById('logout-btn');
    const guestLoginBtn = document.getElementById('guest-login-btn');
    const loginNavBtn = document.getElementById('login-nav-btn');
    const navItems = document.querySelectorAll('.nav-item');
    const homeContent = document.getElementById('home-content');
    const mapContainer = document.querySelector('.map-container');
    const locationsSidebar = document.getElementById('locations-sidebar');
    const collectionsSidebar = document.getElementById('collections-sidebar');
    const worldTravelSidebar = document.getElementById('world-travel-sidebar');
    const startAddZoneBtn = document.getElementById('start-add-zone-btn');
    const addZoneForm = document.getElementById('add-zone-form');
    const cancelAddZoneBtn = document.getElementById('cancel-add-zone-btn');
    const zoneListContainer = document.getElementById('zone-list-container');
    const createCollectionForm = document.getElementById('create-collection-form');
    const collectionListContainer = document.getElementById('collection-list-container');
    const addToCollectionModal = document.getElementById('add-to-collection-modal');
    const modalCloseBtn = document.querySelector('#add-to-collection-modal .close-btn');
    const collectionsDropdown = document.getElementById('collections-dropdown');
    const confirmAddBtn = document.getElementById('confirm-add-btn');
    const globalWarningListContainer = document.getElementById('global-warning-list-container');

    // State Variables
    let currentUser = null;
    let map = null;
    let tempMarker = null;
    let isAddMode = false;
    let newZoneCoords = null;
    let allZones = [];
    let allCollections = [];
    let activePage = 'home';
    let zoneLayers = { safe: null, warning: null, danger: null };
    let selectedZoneToAdd = null;
    let collectionsListenerUnsubscribe = null;

    // --- TYPING EFFECT ---
    const words = [
        'Travix',
        'ट्रैविक्स',  // Hindi (Devanagari)
        'ਟ੍ਰੈਵਿਕਸ',   // Punjabi (Gurmukhi)
        'ત્રાવિક્સ',   // Gujarati
        'ట్రావిక్స్',  // Telugu
        'ಟ್ರಾವಿಕ್ಸ್', // Kannada
        'ട്രാവിക്സ്',  // Malayalam
        'ত্রাভিক্স',   // Bengali
        'ଟ୍ରାଭିକ୍ସ',   // Odia
        'त्राविक्स'    // Marathi (Devanagari)
    ];
    
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 150;
    
    function typeWriter() {
        const typingElement = document.getElementById('typing-text');
        const currentWord = words[wordIndex];
        
        if (!typingElement) return;
        
        if (isDeleting) {
            typingElement.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
            typingSpeed = 100;
        } else {
            typingElement.textContent = currentWord.substring(0, charIndex + 1);
            charIndex++;
            typingSpeed = 150;
        }
        
        if (!isDeleting && charIndex === currentWord.length) {
            // Pause before starting to delete
            typingSpeed = 2000;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            // Move to next word
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            typingSpeed = 500;
        }
        
        setTimeout(typeWriter, typingSpeed);
    }
    
    // Start typing effect when home page loads
    function startTypingEffect() {
        setTimeout(() => {
            typeWriter();
        }, 1000);
    }

    // --- AUTHENTICATION LOGIC ---
    let isLogin = true;
    toggleLink.addEventListener('click', () => {
        isLogin = !isLogin;
        authError.textContent = '';
        loginForm.style.display = isLogin ? 'block' : 'none';
        signupForm.style.display = isLogin ? 'none' : 'block';
        toggleText.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
        toggleLink.textContent = isLogin ? 'Sign Up' : 'Login';
    });
    
    loginNavBtn.addEventListener('click', () => {
        authContainer.style.display = 'flex';
    });

    authContainer.addEventListener('click', (e) => {
        if (e.target === authContainer) {
            authContainer.style.display = 'none';
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        authError.textContent = '';
        try { await auth.signInWithEmailAndPassword(email, password); } catch (error) { authError.textContent = error.message; }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        authError.textContent = '';
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await db.collection('userRoles').doc(userCredential.user.uid).set({ email, role: 'customer' });
        } catch (error) { authError.textContent = error.message; }
    });
    
    guestLoginBtn.addEventListener('click', async () => {
        authError.textContent = '';
        try {
            await auth.signInAnonymously();
        } catch (error) {
            authError.textContent = error.message;
        }
    });

    logoutBtn.addEventListener('click', () => {
        if (collectionsListenerUnsubscribe) {
            collectionsListenerUnsubscribe();
            collectionsListenerUnsubscribe = null;
        }
        auth.signOut();
    });
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            authContainer.style.display = 'none'; // Hide auth modal on successful login
            if (user.isAnonymous) {
                currentUser = { uid: user.uid, email: 'guest@travix.com', role: 'guest' };
            } else {
                const userRoleDoc = await db.collection('userRoles').doc(user.uid).get();
                const userRole = userRoleDoc.exists ? userRoleDoc.data().role : 'customer';
                currentUser = { uid: user.uid, email: user.email, role: userRole };
            }
        } else {
            currentUser = null;
        }
        initializeApp(currentUser);
    });

    // --- APP INITIALIZATION ---
    async function initializeApp(user) {
        updateNavbar(user);
        document.body.className = user ? `${user.role}-view` : 'guest-view';

        if (!map) {
            map = L.map('map', { attributionControl: false }).setView([28.57, 77.32], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
            zoneLayers.safe = L.layerGroup().addTo(map);
            zoneLayers.warning = L.layerGroup().addTo(map);
            zoneLayers.danger = L.layerGroup().addTo(map);
            setupMapEventListeners(); // FIX: Setup map listeners
        }

        try {
            await fetchZones(); 
        } catch (error) {
            console.error("Could not fetch zones:", error);
            alert("Error: Could not load map data. This might be due to security rules.");
            return;
        }

        if (user && user.role === 'customer') {
            setupCollectionsListener();
        } else {
             if (collectionsListenerUnsubscribe) collectionsListenerUnsubscribe();
        }

        document.getElementById('manage-zones-section').style.display = (user && user.role === 'authority') ? 'block' : 'none';
        
        // Reset to home page on auth change
        document.querySelector('.nav-item.active').classList.remove('active');
        document.querySelector('.nav-item[data-page="home"]').classList.add('active');
        renderHomePage();
        updateSafetyStats();
        startAlertCycle();
    }

    // --- UI & NAVBAR LOGIC ---
    function updateNavbar(user) {
        const userInfo = document.querySelector('.user-info');
        if (user) {
            userInfo.style.display = 'flex';
            logoutBtn.style.display = 'block';
            loginNavBtn.style.display = 'none';
            document.getElementById('user-avatar').textContent = user.email.substring(0, 2).toUpperCase();
            document.querySelector('.nav-item[data-page="collections"]').style.display = user.role === 'customer' ? 'flex' : 'none';
        } else {
            userInfo.style.display = 'none';
            logoutBtn.style.display = 'none';
            loginNavBtn.style.display = 'block';
            document.querySelector('.nav-item[data-page="collections"]').style.display = 'none';
        }
    }
    
    // --- DATA MANAGEMENT (FIRESTORE) ---
    async function fetchZones() {
        const snapshot = await db.collection('zones').get();
        allZones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    function setupCollectionsListener() {
        if (!currentUser || currentUser.role !== 'customer') return;
        if (collectionsListenerUnsubscribe) collectionsListenerUnsubscribe();
        
        collectionsListenerUnsubscribe = db.collection('collections')
          .where('userId', '==', currentUser.uid)
          .onSnapshot(snapshot => {
            allCollections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (activePage === 'collections') renderCollectionsPage();
          }, error => console.error("Error fetching collections: ", error));
    }

    async function handleAddZone(e) {
        e.preventDefault();
        if (!newZoneCoords) return alert('Please select a location on the map.');
        const newZone = {
            name: document.getElementById('zone-name').value || 'Untitled Zone',
            type: document.getElementById('zone-type').value,
            lat: newZoneCoords.lat,
            lng: newZoneCoords.lng,
            radius: 800
        };
        try {
            await db.collection('zones').add(newZone);
            await fetchZones();
            renderLocationsPage();
            setAddMode(false);
        } catch (error) { console.error("Error adding zone: ", error); }
    }

    async function handleRemoveZone(zoneId) {
        const zoneToRemove = allZones.find(z => z.id === zoneId);
        if (!zoneToRemove || !confirm(`Remove "${zoneToRemove.name}"?`)) return;
        try {
            await db.collection('zones').doc(zoneId).delete();
            await fetchZones();
            renderLocationsPage();
            map.closePopup();
        } catch (error) { console.error("Error removing zone: ", error); }
    }

    async function handleCreateCollection(e) {
        e.preventDefault();
        const name = document.getElementById('new-collection-name').value;
        if (!name || !currentUser) return;
        try {
            await db.collection('collections').add({
                name,
                userId: currentUser.uid,
                zoneIds: []
            });
            document.getElementById('new-collection-name').value = '';
        } catch (error) { console.error("Error creating collection: ", error); }
    }
    
    async function handleRemoveCollection(collectionId) {
        const collectionToRemove = allCollections.find(c => c.id === collectionId);
        if (!collectionToRemove || !confirm(`Are you sure you want to delete the collection "${collectionToRemove.name}"?`)) return;
        try {
            await db.collection('collections').doc(collectionId).delete();
        } catch (error) {
            console.error("Error removing collection: ", error);
            alert("Failed to delete collection.");
        }
    }

    async function handleAddToCollection(zoneId, collectionId) {
        const collectionRef = db.collection('collections').doc(collectionId);
        try {
            await collectionRef.update({
                zoneIds: firebase.firestore.FieldValue.arrayUnion(zoneId)
            });
            document.getElementById('modal-message').textContent = 'Zone added to collection!';
            setTimeout(() => {
                addToCollectionModal.style.display = 'none';
                document.getElementById('modal-message').textContent = '';
            }, 1000);
        } catch (error) {
            console.error("Error adding zone to collection: ", error);
            document.getElementById('modal-message').textContent = 'Error adding zone.';
        }
    }
    
    document.querySelector('.search-box input').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        if (activePage !== 'locations') return;
        const filteredZones = searchTerm === '' ? allZones : allZones.filter(zone => zone.name.toLowerCase().includes(searchTerm));
        renderMap(filteredZones, 'locations');
        renderZoneList(filteredZones);
    });

    // --- PAGE RENDERING ---
    function renderHomePage() {
        activePage = 'home';
        homeContent.style.display = 'block';
        mapContainer.style.display = 'none';
        locationsSidebar.style.display = 'none';
        collectionsSidebar.style.display = 'none';
        worldTravelSidebar.style.display = 'none';
        initializeHomePage();
        // Start typing effect when home page is rendered
        startTypingEffect();
    }

    function renderLocationsPage() {
        activePage = 'locations';
        homeContent.style.display = 'none';
        mapContainer.style.display = 'block';
        renderMap(allZones, 'locations');
        renderZoneList(allZones);
        updateSafetyStats();
        locationsSidebar.style.display = 'flex';
        collectionsSidebar.style.display = 'none';
        worldTravelSidebar.style.display = 'none';
        if(map) map.invalidateSize();
    }

    function renderCollectionsPage(zonesToDisplay = null) {
        activePage = 'collections';
        homeContent.style.display = 'none';
        mapContainer.style.display = 'block';
        collectionListContainer.innerHTML = '';
        allCollections.forEach(collection => {
            const listItem = document.createElement('div');
            listItem.className = 'collection-item';
            listItem.innerHTML = `
                <div class="collection-info" data-id="${collection.id}">
                    <div class="collection-name">${collection.name}</div>
                    <div class="collection-count">${collection.zoneIds.length} zones</div>
                </div>
                <i class="fas fa-trash-alt remove-collection-btn" data-id="${collection.id}" title="Remove Collection"></i>
            `;
            collectionListContainer.appendChild(listItem);
        });

        renderMap(zonesToDisplay === null ? allZones : zonesToDisplay, 'collections', zonesToDisplay !== null);
        locationsSidebar.style.display = 'none';
        collectionsSidebar.style.display = 'flex';
        worldTravelSidebar.style.display = 'none';
        if(map) map.invalidateSize();
    }

    function renderWorldTravelPage() {
        activePage = 'world-travel';
        homeContent.style.display = 'none';
        mapContainer.style.display = 'block';
        renderMap(allZones, 'world-travel');
        renderGlobalWarningList();
        locationsSidebar.style.display = 'none';
        collectionsSidebar.style.display = 'none';
        worldTravelSidebar.style.display = 'flex';
        if(map) {
            map.invalidateSize();
            map.flyTo([20, 0], 2);
        }
    }

    function renderGlobalWarningList() {
        const container = document.getElementById('global-warning-list-container');
        container.innerHTML = '';
        const topCautionZones = allZones.filter(zone => zone.type === 'danger' || zone.type === 'warning');
        if (topCautionZones.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9em;">No caution or restricted zones found.</p>';
            return;
        }
        topCautionZones.sort((a, b) => (a.type === 'danger' && b.type !== 'danger') ? -1 : (a.type !== 'danger' && b.type === 'danger') ? 1 : 0);
        topCautionZones.forEach(zone => {
            const listItem = document.createElement('div');
            listItem.className = 'zone-item';
            listItem.innerHTML = `
                <div class="zone-item-content" data-lat="${zone.lat}" data-lng="${zone.lng}">
                    <div class="zone-indicator ${zone.type}"></div>
                    <div class="zone-info">
                        <div class="zone-name">${zone.name}</div>
                        <div class="zone-count">${zone.type.charAt(0).toUpperCase() + zone.type.slice(1)} Zone</div>
                    </div>
                </div>
            `;
            container.appendChild(listItem);
        });
    }

    // --- MAP & UI INTERACTION ---
    function renderMap(zones, page, filter = false) {
        Object.values(zoneLayers).forEach(layer => layer.clearLayers());
        const activeToggles = {
            safe: document.querySelector('.toggle-switch[data-zone-type="safe"]').classList.contains('active'),
            warning: document.querySelector('.toggle-switch[data-zone-type="warning"]').classList.contains('active'),
            danger: document.querySelector('.toggle-switch[data-zone-type="danger"]').classList.contains('active')
        };
        zones.forEach(zone => {
            if (page === 'world-travel' || filter || activeToggles[zone.type]) {
                const zoneStyles = { safe: { color: 'var(--success)' }, warning: { color: 'var(--warning)' }, danger: { color: 'var(--danger)' } };
                const circle = L.circle([zone.lat, zone.lng], {
                    color: zoneStyles[zone.type].color, fillColor: zoneStyles[zone.type].color,
                    fillOpacity: zone.type === 'danger' ? 0.2 : 0.15, radius: zone.radius, weight: 2,
                    dashArray: zone.type === 'danger' ? '5, 5' : null
                }).addTo(zoneLayers[zone.type]);
                let popupContent = `<b>${zone.name}</b><br>Status: ${zone.type}`;
                if (currentUser) {
                    if (currentUser.role === 'authority') {
                         popupContent += `<br><button class="remove-zone-popup-btn" data-id="${zone.id}">Remove Zone</button>`;
                    } else if (currentUser.role === 'customer' && page === 'locations') {
                        popupContent += `<br><button class="add-to-collection-popup-btn" data-id="${zone.id}">Add to Collection</button>`;
                    }
                }
                circle.bindPopup(popupContent);
            }
        });
    }

    function renderZoneList(zones) {
        zoneListContainer.innerHTML = '';
        zones.forEach(zone => {
            const listItem = document.createElement('div');
            listItem.className = 'zone-item';
            listItem.innerHTML = `<div class="zone-item-content" data-lat="${zone.lat}" data-lng="${zone.lng}">
                    <div class="zone-indicator ${zone.type}"></div>
                    <div class="zone-info"><div class="zone-name">${zone.name}</div><div class="zone-count">${zone.lat.toFixed(4)}, ${zone.lng.toFixed(4)}</div></div>
                </div>
                ${(currentUser && currentUser.role === 'authority') ? `<i class="fas fa-trash-alt remove-zone-btn" data-id="${zone.id}" title="Remove Zone"></i>` : ''}`;
            zoneListContainer.appendChild(listItem);
        });
    }

    function updateSafetyStats() {
        document.getElementById('total-locations-stat').textContent = allZones.length;
        document.getElementById('active-alerts-stat').textContent = allZones.filter(z => z.type === 'warning' || z.type === 'danger').length;
    }

    function setAddMode(enabled) {
        isAddMode = enabled;
        startAddZoneBtn.style.display = enabled ? 'none' : 'flex';
        addZoneForm.style.display = enabled ? 'flex' : 'none';
        document.getElementById('map').classList.toggle('add-mode', enabled);
        if (enabled) map.on('click', onMapClick); else map.off('click', onMapClick);
        if (!enabled && tempMarker) {
            map.removeLayer(tempMarker); tempMarker = null;
            newZoneCoords = null; document.getElementById('coords-display').textContent = 'Click on the map to set location';
            addZoneForm.reset();
        }
    }

    function onMapClick(e) {
        newZoneCoords = e.latlng;
        document.getElementById('coords-display').textContent = `Coords: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
        if (tempMarker) map.removeLayer(tempMarker);
        tempMarker = L.marker(newZoneCoords).addTo(map);
    }
    
    // --- EVENT HANDLERS ---
    function setupMapEventListeners() {
        // FIX: Handle clicks on dynamically created popup buttons
        map.on('popupopen', function (e) {
            const popupNode = e.popup.getElement();
            const addToCollectionBtn = popupNode.querySelector('.add-to-collection-popup-btn');
            const removeZoneBtn = popupNode.querySelector('.remove-zone-popup-btn');

            if (addToCollectionBtn) {
                addToCollectionBtn.addEventListener('click', () => {
                    selectedZoneToAdd = allZones.find(z => z.id === addToCollectionBtn.dataset.id);
                    if (selectedZoneToAdd) showAddToCollectionModal();
                });
            }

            if (removeZoneBtn) {
                 removeZoneBtn.addEventListener('click', () => {
                    handleRemoveZone(removeZoneBtn.dataset.id);
                 });
            }
        });
    }

    function handleNavClick(e) {
        e.preventDefault();
        const page = e.currentTarget.dataset.page;
        if (page === activePage) return;
        navItems.forEach(item => item.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        if (page === 'home') renderHomePage();
        else if (page === 'locations') renderLocationsPage();
        else if (page === 'collections') renderCollectionsPage();
        else if (page === 'world-travel') renderWorldTravelPage();
    }
    
    // Centralized click handler for the document body
    document.body.addEventListener('click', (e) => {
        // Sidebar zone removal button
        if (currentUser && currentUser.role === 'authority' && e.target.matches('.remove-zone-btn')) {
            handleRemoveZone(e.target.dataset.id);
        }
        // Modal close button
        else if (e.target.matches('.close-btn')) {
             addToCollectionModal.style.display = 'none';
        }
        // View a collection's zones
        else if (e.target.closest('.collection-info')) {
            const collectionId = e.target.closest('.collection-info').dataset.id;
            const collection = allCollections.find(c => c.id === collectionId);
            const zonesToDisplay = allZones.filter(z => collection.zoneIds.includes(z.id));
            renderCollectionsPage(zonesToDisplay);
        }
        // Remove a collection
        else if (e.target.matches('.remove-collection-btn')) {
            e.stopPropagation(); 
            handleRemoveCollection(e.target.dataset.id);
        }
        // Confirm adding a zone to a collection
        else if (e.target.matches('#confirm-add-btn')) {
            const collectionId = collectionsDropdown.value;
            if (selectedZoneToAdd && collectionId) {
                handleAddToCollection(selectedZoneToAdd.id, collectionId);
            }
        }
        // Pan map to a zone from a list
        const zoneItemContent = e.target.closest('.zone-item-content');
        if (zoneItemContent) {
            map.flyTo([zoneItemContent.dataset.lat, zoneItemContent.dataset.lng], 14);
        }
        
        // Handle map filter toggles
        const toggle = e.target.closest('.toggle-switch');
        if(toggle && activePage === 'locations') {
              toggle.classList.toggle('active');
              renderMap(allZones, activePage);
        }
    });

    // --- MODAL LOGIC ---
    function showAddToCollectionModal() {
        document.querySelector('#add-to-collection-modal h4').textContent = `Add "${selectedZoneToAdd.name}" to Collection`;
        collectionsDropdown.innerHTML = '';
        const collectionsToDisplay = allCollections.filter(
            collection => !collection.zoneIds.includes(selectedZoneToAdd.id)
        );
        if (collectionsToDisplay.length > 0) {
            collectionsToDisplay.forEach(collection => {
                const option = document.createElement('option');
                option.value = collection.id;
                option.textContent = collection.name;
                collectionsDropdown.appendChild(option);
            });
            confirmAddBtn.style.display = 'block';
            document.getElementById('modal-message').textContent = '';
        } else {
            collectionsDropdown.innerHTML = '<option disabled>No other collections available.</option>';
            document.getElementById('modal-message').textContent = 'This zone is in all collections or you have none.';
            confirmAddBtn.style.display = 'none';
        }
        addToCollectionModal.style.display = 'flex';
    }

    // --- DYNAMIC CONTENT & ALERTS ---
    let currentZoneIndex = 0;
    function startAlertCycle() {
        setInterval(() => {
            if (allZones.length === 0) { updateUserAlert(null); return; }
            currentZoneIndex = (currentZoneIndex + 1) % allZones.length;
            updateUserAlert(allZones[currentZoneIndex]);
        }, 5000);
    }
    
    function updateUserAlert(zone) {
        const panel = document.getElementById('alertPanel');
        if (!zone) { panel.style.display = 'none'; return; }
        panel.style.display = 'block';
        const configs = {
            safe: { icon: 'fa-check-circle', title: 'Safe Zone', msg: 'You are in a verified safe area' },
            warning: { icon: 'fa-exclamation-triangle', title: 'Caution Area', msg: 'Limited monitoring in this area' },
            danger: { icon: 'fa-times-circle', title: 'Restricted Zone', msg: 'Please leave this area immediately' }
        };
        const config = configs[zone.type];
        panel.className = `alert-panel ${zone.type}`;
        panel.innerHTML = `<div class="alert-header"><div class="alert-icon ${zone.type}"><i class="fas ${config.icon}"></i></div><div class="alert-content"><h3>${config.title}</h3><p>${config.msg}</p></div></div><div class="alert-details"><div class="detail-row"><span>Current Zone:</span><span>${zone.name}</span></div><div class="detail-row"><span>Last Updated:</span><span>Just now</span></div></div>`;
    }
    
    // --- HOME PAGE SPECIFIC SCRIPT ---
    function initializeHomePage() {
        function animateCounter(element, target, duration = 2000) {
            const start = 0;
            const increment = target / (duration / 16);
            let current = start;
            
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                
                let displayValue;
                if (target >= 1000) {
                    displayValue = Math.floor(current).toLocaleString() + '+';
                } else {
                    displayValue = Math.floor(current) + (target === 99 ? '%' : '+');
                }
                
                element.textContent = displayValue;
            }, 16);
        }

        function initStatsCounters() {
            const statItems = document.querySelectorAll('.stat-item');
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const statNumber = entry.target.querySelector('.stat-number');
                        const targetValue = parseInt(entry.target.dataset.count);
                        
                        setTimeout(() => {
                            animateCounter(statNumber, targetValue);
                        }, Math.random() * 500);
                        
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });

            statItems.forEach((item) => observer.observe(item));
        }

        function initCTAButtons() {
            const exploreBtn = document.getElementById('explore-locations-btn');
            if (exploreBtn) {
                exploreBtn.addEventListener('click', () => {
                    document.querySelector('.nav-item[data-page="locations"]').click();
                });
            }
            const learnMoreBtn = document.getElementById('learn-more-btn');
            if (learnMoreBtn) {
                learnMoreBtn.addEventListener('click', () => {
                    document.querySelector('.features-section').scrollIntoView({ behavior: 'smooth' });
                });
            }
            const getStartedBtn = document.getElementById('get-started-btn');
            if (getStartedBtn) {
                getStartedBtn.addEventListener('click', () => {
                    document.querySelector('.nav-item[data-page="locations"]').click();
                });
            }
        }

        initStatsCounters();
        initCTAButtons();
    }
    
    // Attach event listeners that only need to be set once
    navItems.forEach(item => item.addEventListener('click', handleNavClick));
    startAddZoneBtn.addEventListener('click', () => setAddMode(true));
    cancelAddZoneBtn.addEventListener('click', () => setAddMode(false));
    addZoneForm.addEventListener('submit', handleAddZone);
    createCollectionForm.addEventListener('submit', handleCreateCollection);
});
