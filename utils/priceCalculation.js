const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateEstimatedTime = (distance) => {
  const averageSpeed = 30;
  const timeInHours = distance / averageSpeed;
  return Math.ceil(timeInHours * 60);
};

const getVehiclePricing = (vehicleType, carVariety = null) => {
  const pricing = {
    scooty: {
      baseFare: 25,
      perKmRate: 8,
      perMinuteRate: 0.5,
      minimumFare: 40,
      minimumDistance: 2
    },
    bike: {
      baseFare: 30,
      perKmRate: 10,
      perMinuteRate: 0.6,
      minimumFare: 50,
      minimumDistance: 2
    },
    car: {
      baseFare: 50,
      perKmRate: 15,
      perMinuteRate: 1.0,
      minimumFare: 80,
      minimumDistance: 3
    },
    car_plus: {
      baseFare: 60,
      perKmRate: 18,
      perMinuteRate: 1.2,
      minimumFare: 100,
      minimumDistance: 3
    },
    car_lite: {
      baseFare: 45,
      perKmRate: 12,
      perMinuteRate: 0.8,
      minimumFare: 70,
      minimumDistance: 3
    },
    taxi: {
      baseFare: 55,
      perKmRate: 16,
      perMinuteRate: 1.1,
      minimumFare: 90,
      minimumDistance: 3
    }
  };
  
  if (vehicleType === 'car' && carVariety) {
    return pricing[carVariety] || pricing.car;
  }
  
  return pricing[vehicleType] || pricing.bike;
};

const calculateSurgeMultiplier = (demandLevel = 1) => {
  if (demandLevel <= 1) return 1.0;
  if (demandLevel <= 1.5) return 1.2;
  if (demandLevel <= 2) return 1.5;
  if (demandLevel <= 2.5) return 1.8;
  return 2.0;
};

const calculateRidePrice = (fromLat, fromLon, toLat, toLon, vehicleType, surgeMultiplier = 1.0, carVariety = null) => {
  const distance = calculateDistance(parseFloat(fromLat), parseFloat(fromLon), parseFloat(toLat), parseFloat(toLon));
  const estimatedDuration = calculateEstimatedTime(distance);
  const pricing = getVehiclePricing(vehicleType, carVariety);
  
  let baseFare = pricing.baseFare;
  let distanceFare = 0;
  let timeFare = 0;
  
  if (distance > pricing.minimumDistance) {
    const extraDistance = distance - pricing.minimumDistance;
    distanceFare = extraDistance * pricing.perKmRate;
  }
  
  timeFare = estimatedDuration * pricing.perMinuteRate;
  
  let totalFare = baseFare + distanceFare + timeFare;
  
  totalFare = totalFare * surgeMultiplier;
  
  if (totalFare < pricing.minimumFare) {
    totalFare = pricing.minimumFare;
  }
  
  totalFare = Math.round(totalFare * 100) / 100;
  
  return {
    distance: Math.round(distance * 100) / 100,
    estimatedDuration,
    baseFare: Math.round(baseFare * 100) / 100,
    distanceFare: Math.round(distanceFare * 100) / 100,
    timeFare: Math.round(timeFare * 100) / 100,
    surgeMultiplier: Math.round(surgeMultiplier * 100) / 100,
    totalFare
  };
};

const calculateActualRidePrice = (actualDistance, actualDuration, vehicleType, surgeMultiplier = 1.0, carVariety = null) => {
  const pricing = getVehiclePricing(vehicleType, carVariety);
  
  let baseFare = pricing.baseFare;
  let distanceFare = 0;
  let timeFare = 0;
  
  if (actualDistance > pricing.minimumDistance) {
    const extraDistance = actualDistance - pricing.minimumDistance;
    distanceFare = extraDistance * pricing.perKmRate;
  }
  
  timeFare = actualDuration * pricing.perMinuteRate;
  
  let totalFare = baseFare + distanceFare + timeFare;
  
  totalFare = totalFare * surgeMultiplier;
  
  if (totalFare < pricing.minimumFare) {
    totalFare = pricing.minimumFare;
  }
  
  totalFare = Math.round(totalFare * 100) / 100;
  
  return {
    distance: Math.round(actualDistance * 100) / 100,
    duration: actualDuration,
    baseFare: Math.round(baseFare * 100) / 100,
    distanceFare: Math.round(distanceFare * 100) / 100,
    timeFare: Math.round(timeFare * 100) / 100,
    surgeMultiplier: Math.round(surgeMultiplier * 100) / 100,
    totalFare
  };
};

module.exports = {
  calculateDistance,
  calculateEstimatedTime,
  calculateRidePrice,
  calculateActualRidePrice,
  calculateSurgeMultiplier,
  getVehiclePricing
};
