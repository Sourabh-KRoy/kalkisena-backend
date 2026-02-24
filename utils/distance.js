/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
};

/**
 * Convert degrees to radians
 */
const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Find drivers within a specified radius (in kilometers)
 */
const findDriversWithinRadius = (userLat, userLon, drivers, radiusKm = 2) => {
  return drivers.filter(driver => {
    if (!driver.current_latitude || !driver.current_longitude) {
      return false;
    }
    
    const distance = calculateDistance(
      parseFloat(userLat),
      parseFloat(userLon),
      parseFloat(driver.current_latitude),
      parseFloat(driver.current_longitude)
    );
    
    return distance <= radiusKm;
  }).map(driver => {
    const distance = calculateDistance(
      parseFloat(userLat),
      parseFloat(userLon),
      parseFloat(driver.current_latitude),
      parseFloat(driver.current_longitude)
    );
    
    return {
      ...driver.toJSON(),
      distance_from_user: parseFloat(distance.toFixed(2)) // Distance in km, rounded to 2 decimals
    };
  });
};

module.exports = {
  calculateDistance,
  findDriversWithinRadius
};
