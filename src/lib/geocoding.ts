export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'MobiStock/1.0' } }
    );
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    const addr = data.address;
    if (!addr) return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    const parts: string[] = [];
    // Most specific first
    if (addr.amenity) parts.push(addr.amenity);
    else if (addr.building) parts.push(addr.building);
    else if (addr.shop) parts.push(addr.shop);
    
    if (addr.house_number && addr.road) {
      parts.push(`${addr.house_number}, ${addr.road}`);
    } else if (addr.road) {
      parts.push(addr.road);
    }
    
    if (addr.neighbourhood) parts.push(addr.neighbourhood);
    else if (addr.quarter) parts.push(addr.quarter);
    
    if (addr.suburb && addr.suburb !== addr.neighbourhood) parts.push(addr.suburb);
    
    if (addr.city || addr.town || addr.village) {
      parts.push(addr.city || addr.town || addr.village);
    }
    if (addr.state_district) parts.push(addr.state_district);
    if (addr.state) parts.push(addr.state);
    if (addr.postcode) parts.push(addr.postcode);
    
    return parts.length > 0 ? parts.join(', ') : data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}
