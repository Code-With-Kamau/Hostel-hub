const MapModule = {
  map: null, markers: [], userMarker: null, infoWindow: null,
  userLat: null, userLng: null, mapLoaded: false,

  loadGoogleMaps() {
    if (window.google?.maps) { this.mapLoaded = true; return Promise.resolve(); }
    return new Promise((resolve) => {
      window.__mapReady = () => { this.mapLoaded = true; document.dispatchEvent(new Event('maps-ready')); resolve(); };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_KEY || ''}&libraries=places,geometry&callback=__mapReady`;
      s.async = true; document.head.appendChild(s);
    });
  },

  initMap(elId, center = { lat: -1.2921, lng: 36.8219 }, zoom = 12) {
    if (!window.google?.maps) return null;
    this.map = new google.maps.Map(document.getElementById(elId), {
      center, zoom, mapTypeControl: false, streetViewControl: false, fullscreenControl: true,
      styles: [
        { featureType:'poi.business', stylers:[{ visibility:'off' }] },
        { featureType:'water', elementType:'geometry', stylers:[{ color:'#bfdbfe' }] },
        { featureType:'landscape', elementType:'geometry', stylers:[{ color:'#f8fafc' }] },
      ]
    });
    this.infoWindow = new google.maps.InfoWindow();
    return this.map;
  },

  clearMarkers() { this.markers.forEach(m => m.setMap(null)); this.markers = []; },

  addHostelMarker(h) {
    if (!this.map || !h.latitude || !h.longitude) return;
    const marker = new google.maps.Marker({
      position: { lat: parseFloat(h.latitude), lng: parseFloat(h.longitude) },
      map: this.map, title: h.title, animation: google.maps.Animation.DROP,
      icon: { url:'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46"><ellipse cx="19" cy="42" rx="7" ry="3" fill="rgba(0,0,0,0.2)"/><rect x="1" y="1" width="36" height="36" rx="8" fill="#1e3a5f"/><text x="19" y="25" text-anchor="middle" font-size="18">🏢</text></svg>`),
        scaledSize: new google.maps.Size(38, 46), anchor: new google.maps.Point(19, 42) }
    });
    marker.addListener('click', () => {
      const img = h.primary_image || CONFIG.DEFAULT_HOSTEL;
      this.infoWindow.setContent(`<div class="map-infowindow">
        <img src="${img}" onerror="this.style.display='none'"/>
        <h4>${h.title}</h4>
        <div class="price">${formatKES(h.price_per_month)}/month</div>
        <div style="font-size:.74rem;color:#666;margin-top:3px">${roomTypeName(h.room_type)} • ${h.nearest_institution||h.location}</div>
        <a class="btn-view" onclick="navigate('hostel',${h.id})">View Details →</a>
      </div>`);
      this.infoWindow.open(this.map, marker);
    });
    this.markers.push(marker);
  },

  addHostelsToMap(hostels) {
    this.clearMarkers();
    const bounds = new google.maps.LatLngBounds();
    hostels.forEach(h => { if (h.latitude) { this.addHostelMarker(h); bounds.extend({ lat: parseFloat(h.latitude), lng: parseFloat(h.longitude) }); } });
    if (!bounds.isEmpty()) { this.map.fitBounds(bounds); if (hostels.length === 1) this.map.setZoom(15); }
  },

  getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject('Geolocation not supported');
      navigator.geolocation.getCurrentPosition(
        p => { this.userLat = p.coords.latitude; this.userLng = p.coords.longitude; resolve({ lat: this.userLat, lng: this.userLng }); },
        e => reject(e.message), { timeout: 10000 }
      );
    });
  },

  addUserMarker(lat, lng) {
    if (!this.map) return;
    if (this.userMarker) this.userMarker.setMap(null);
    this.userMarker = new google.maps.Marker({
      position: { lat, lng }, map: this.map, title: 'Your Location',
      icon: { url:'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill="#3b82f6" opacity="0.3"/><circle cx="11" cy="11" r="6" fill="#2563eb"/><circle cx="11" cy="11" r="2.5" fill="white"/></svg>`),
        scaledSize: new google.maps.Size(22, 22), anchor: new google.maps.Point(11, 11) }
    });
  },

  getDirections(lat, lng) {
    const base = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const url = this.userLat ? `${base}&origin=${this.userLat},${this.userLng}` : base;
    window.open(url, '_blank');
  },

  openPinPicker(callback) {
    openModal(`
      <div class="modal-title">📍 Pin Your Hostel Location</div>
      <p style="color:var(--gray-500);font-size:.875rem;margin-bottom:14px">Click on the map to set your exact location</p>
      <div id="pin-map" style="height:380px;border-radius:10px;overflow:hidden;background:var(--gray-100)"></div>
      <div id="pin-addr" style="margin-top:10px;padding:9px;background:var(--gray-50);border-radius:8px;font-size:.84rem;color:var(--gray-500)">📍 Click on the map to select</div>
      <button class="btn btn-blue btn-block" style="margin-top:12px" id="pin-confirm" disabled>Confirm Location</button>
    `, true);
    setTimeout(() => {
      const pinMap = this.initMap('pin-map', { lat: -1.2921, lng: 36.8219 }, 12);
      if (!pinMap) return;
      let pinMarker = null, selLat = null, selLng = null;
      pinMap.addListener('click', (e) => {
        selLat = e.latLng.lat(); selLng = e.latLng.lng();
        if (pinMarker) pinMarker.setMap(null);
        pinMarker = new google.maps.Marker({ position: e.latLng, map: pinMap, animation: google.maps.Animation.DROP });
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: e.latLng }, (results, status) => {
          const addr = status === 'OK' && results[0] ? results[0].formatted_address : `${selLat.toFixed(5)}, ${selLng.toFixed(5)}`;
          document.getElementById('pin-addr').textContent = '📍 ' + addr;
          const btn = document.getElementById('pin-confirm');
          btn.disabled = false;
          btn.onclick = () => { callback({ lat: selLat, lng: selLng, address: addr }); closeModal({}); };
        });
      });
    }, 300);
  },
};
