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
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const toggleLink = document.getElementById('toggle-link');
    const toggleText = document.getElementById('toggle-text');
    const roleGroup = document.getElementById('role-group');
    const authError = document.getElementById('auth-error');
    const logoutBtn = document.getElementById('logout-btn');
    const guestLoginBtn = document.getElementById('guest-login-btn');
    const navItems = document.querySelectorAll('.nav-item');
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
    let activePage = 'locations';
    let zoneLayers = { safe: null, warning: null, danger: null };
    let selectedZoneToAdd = null;
    let collectionsListenerUnsubscribe = null;

    // --- AUTHENTICATION LOGIC ---
    let isLogin = true;
    toggleLink.addEventListener('click', () => {
        isLogin = !isLogin;
        authError.textContent = '';
        loginForm.style.display = isLogin ? 'block' : 'none';
        signupForm.style.display = isLogin ? 'none' : 'block';
        if (roleGroup) {
            roleGroup.style.display = isLogin ? 'none' : 'block';
        }
        toggleText.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
        toggleLink.textContent = isLogin ? 'Sign Up' : 'Login';
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

    guestLoginBtn.addEventListener('click', () => {
        const guestUser = { email: 'guest@travix.com', role: 'guest' };
        initializeApp(guestUser);
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
            const userRoleDoc = await db.collection('userRoles').doc(user.uid).get();
            const userRole = userRoleDoc.exists ? userRoleDoc.data().role : 'customer';
            currentUser = { uid: user.uid, email: user.email, role: userRole };
            initializeApp(currentUser);
        } else {
            authContainer.classList.remove('hidden');
            appContainer.classList.remove('visible');
            if (map) map.remove();
            map = null;
        }
    });

    // --- APP INITIALIZATION ---
    async function initializeApp(user) {
        authContainer.classList.add('hidden');
        appContainer.classList.add('visible');
        document.body.className = `${user.role}-view`;
        document.getElementById('user-avatar').textContent = user.email.substring(0, 2).toUpperCase();

        const collectionsNavItem = document.querySelector('.nav-item[data-page="collections"]');
        if (user.role !== 'customer') {
            collectionsNavItem.style.display = 'none';
        } else {
            collectionsNavItem.style.display = 'flex';
        }

        if (!map) {
            map = L.map('map', { attributionControl: false }).setView([28.57, 77.32], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
            zoneLayers.safe = L.layerGroup().addTo(map);
            zoneLayers.warning = L.layerGroup().addTo(map);
            zoneLayers.danger = L.layerGroup().addTo(map);
        }

        await fetchZones(); 

        if (user.role === 'customer') {
            setupCollectionsListener();
        }

        if (user.role === 'authority') {
            document.getElementById('manage-zones-section').style.display = 'block';
            startAddZoneBtn.addEventListener('click', () => setAddMode(true));
            cancelAddZoneBtn.addEventListener('click', () => setAddMode(false));
            addZoneForm.addEventListener('submit', handleAddZone);
        } else {
            document.getElementById('manage-zones-section').style.display = 'none';
        }
        
        createCollectionForm.addEventListener('submit', handleCreateCollection);
        navItems.forEach(item => item.addEventListener('click', handleNavClick));
        document.body.addEventListener('click', handleBodyClick);

        renderLocationsPage();
        updateSafetyStats();
        startAlertCycle();
    }
    
    // --- DATA MANAGEMENT (FIRESTORE) ---
    async function fetchZones() {
        const snapshot = await db.collection('zones').get();
        allZones = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    function setupCollectionsListener() {
        if (currentUser.role !== 'customer') return;
        
        if (collectionsListenerUnsubscribe) {
            collectionsListenerUnsubscribe();
        }
        
        collectionsListenerUnsubscribe = db.collection('collections')
          .where('userId', '==', currentUser.uid)
          .onSnapshot(snapshot => {
            allCollections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (activePage === 'collections') {
                renderCollectionsPage();
            }
          }, error => {
            console.error("Error fetching collections: ", error);
          });
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
        if (!name) return;
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
            // Perform the delete operation in the background
            await db.collection('collections').doc(collectionId).delete();
            // On success, the backend is now in sync with our optimistic UI.
            // The onSnapshot listener will eventually get this update and confirm the state.
        } catch (error) {
            console.error("Error removing collection: ", error);
            alert("Failed to delete collection. Reverting changes.");
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
    
    document.querySelector('.search-box input').addEventListener('input', handleSearch);

    function handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        if (activePage !== 'locations') return;

        const filteredZones = searchTerm === '' ? allZones : allZones.filter(zone => zone.name.toLowerCase().includes(searchTerm));
        renderMap(filteredZones, 'locations');
        renderZoneList(filteredZones);
    }

    // --- UI RENDERING ---
    function renderLocationsPage() {
        activePage = 'locations';
        renderMap(allZones, 'locations');
        renderZoneList(allZones);
        updateSafetyStats();
        locationsSidebar.style.display = 'flex';
        collectionsSidebar.style.display = 'none';
        worldTravelSidebar.style.display = 'none';
    }

    function renderCollectionsPage(zonesToDisplay = null) {
        activePage = 'collections';
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
    }

    function renderWorldTravelPage() {
        activePage = 'world-travel';
        renderMap(allZones, 'world-travel');
        renderGlobalWarningList();
        locationsSidebar.style.display = 'none';
        collectionsSidebar.style.display = 'none';
        worldTravelSidebar.style.display = 'flex';
        map.flyTo([0, 0], 2);
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
                if (currentUser.role === 'authority') {
                     popupContent += `<br><button class="remove-zone-popup-btn" data-id="${zone.id}">Remove Zone</button>`;
                } else if (page === 'locations') {
                    popupContent += `<br><button class="add-to-collection-popup-btn" data-id="${zone.id}">Add to Collection</button>`;
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
                ${currentUser.role === 'authority' ? `<i class="fas fa-trash-alt remove-zone-btn" data-id="${zone.id}" title="Remove Zone"></i>` : ''}`;
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
    function handleNavClick(e) {
        e.preventDefault();
        const page = e.currentTarget.dataset.page;
        if (page === activePage) return;
        navItems.forEach(item => item.classList.remove('active'));
        e.currentTarget.classList.add('active');
        if (page === 'locations') renderLocationsPage();
        else if (page === 'collections') renderCollectionsPage();
        else if (page === 'world-travel') renderWorldTravelPage();
        setTimeout(() => map.invalidateSize(), 100);
    }

    function handleBodyClick(e) {
        if (currentUser.role === 'authority' && e.target.matches('.remove-zone-btn, .remove-zone-popup-btn')) {
            handleRemoveZone(e.target.dataset.id);
        } else if (currentUser.role === 'customer' && e.target.matches('.add-to-collection-popup-btn')) {
            selectedZoneToAdd = allZones.find(z => z.id === e.target.dataset.id);
            if (selectedZoneToAdd) showAddToCollectionModal();
        } else if (e.target.matches('.close-btn')) {
             addToCollectionModal.style.display = 'none';
        } else if (e.target.closest('.collection-info')) {
            const collectionId = e.target.closest('.collection-info').dataset.id;
            const collection = allCollections.find(c => c.id === collectionId);
            const zonesToDisplay = allZones.filter(z => collection.zoneIds.includes(z.id));
            renderCollectionsPage(zonesToDisplay);
        } else if (e.target.matches('.remove-collection-btn')) {
            e.stopPropagation(); 
            handleRemoveCollection(e.target.dataset.id);
        } else if (e.target.matches('#confirm-add-btn')) {
            const collectionId = collectionsDropdown.value;
            if (selectedZoneToAdd && collectionId) {
                handleAddToCollection(selectedZoneToAdd.id, collectionId);
            }
        }
         const zoneItemContent = e.target.closest('.zone-item-content');
         if (zoneItemContent) map.flyTo([zoneItemContent.dataset.lat, zoneItemContent.dataset.lng], 14);
         
         const toggle = e.target.closest('.toggle-switch');
         if(toggle && activePage === 'locations') {
             toggle.classList.toggle('active');
             renderMap(allZones, activePage);
         }
    }
    
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
        } else {
            const message = document.createElement('p');
            message.textContent = 'This zone is already in all of your collections or you have none. Create one first!';
            collectionsDropdown.innerHTML = ''; // Clear dropdown before adding message
            collectionsDropdown.appendChild(message);
            confirmAddBtn.style.display = 'none';
        }
        addToCollectionModal.style.display = 'flex';
    }

    // --- ALERT LOGIC ---
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
});
