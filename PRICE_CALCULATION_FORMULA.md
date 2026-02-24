# Ride Price Calculation Formula

## Overview
The price calculation follows a multi-component pricing model similar to Rapido, Ola, and Uber. The total fare is calculated using distance, time, base fare, and surge pricing.

---

## Formula Breakdown

### Total Fare Formula:
```
Total Fare = (Base Fare + Distance Fare + Time Fare) × Surge Multiplier
```

**Final Check:**
```
If Total Fare < Minimum Fare:
    Total Fare = Minimum Fare
```

---

## Step-by-Step Calculation

### Step 1: Calculate Distance (Haversine Formula)

**Formula:**
```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1-a))
Distance (km) = R × c
```

Where:
- `R` = Earth's radius = 6,371 km
- `Δlat` = Difference in latitude (in radians)
- `Δlon` = Difference in longitude (in radians)
- `lat1, lon1` = From location coordinates
- `lat2, lon2` = To location coordinates

**Example:**
- From: 28.6139°N, 77.2090°E (Delhi)
- To: 28.5355°N, 77.3910°E
- Distance ≈ 25.5 km

---

### Step 2: Calculate Estimated Time

**Formula:**
```
Time (minutes) = ⌈(Distance / Average Speed) × 60⌉
```

Where:
- Average Speed = 30 km/h (configurable)
- `⌈⌉` = Ceiling function (round up)

**Example:**
- Distance = 25.5 km
- Time = ⌈(25.5 / 30) × 60⌉ = ⌈51⌉ = 51 minutes

---

### Step 3: Get Vehicle Pricing

**Pricing Structure:**

| Vehicle Type | Base Fare | Per Km Rate | Per Minute Rate | Minimum Fare | Minimum Distance |
|-------------|-----------|-------------|----------------|--------------|------------------|
| Scooty      | ₹25       | ₹8/km       | ₹0.5/min       | ₹40          | 2 km             |
| Bike        | ₹30       | ₹10/km      | ₹0.6/min       | ₹50          | 2 km             |
| Car         | ₹50       | ₹15/km      | ₹1.0/min       | ₹80          | 3 km             |
| Car Plus    | ₹60       | ₹18/km      | ₹1.2/min       | ₹100         | 3 km             |
| Car Lite    | ₹45       | ₹12/km      | ₹0.8/min       | ₹70          | 3 km             |
| Taxi        | ₹55       | ₹16/km      | ₹1.1/min       | ₹90          | 3 km             |

---

### Step 4: Calculate Base Fare

**Formula:**
```
Base Fare = Fixed amount based on vehicle type
```

**Example (Bike):**
- Base Fare = ₹30

---

### Step 5: Calculate Distance Fare

**Formula:**
```
If Distance > Minimum Distance:
    Extra Distance = Distance - Minimum Distance
    Distance Fare = Extra Distance × Per Km Rate
Else:
    Distance Fare = 0
```

**Example (Bike, 25.5 km):**
- Minimum Distance = 2 km
- Extra Distance = 25.5 - 2 = 23.5 km
- Distance Fare = 23.5 × ₹10 = ₹235

---

### Step 6: Calculate Time Fare

**Formula:**
```
Time Fare = Estimated Duration (minutes) × Per Minute Rate
```

**Example (Bike, 51 minutes):**
- Time Fare = 51 × ₹0.6 = ₹30.6

---

### Step 7: Apply Surge Multiplier

**Surge Multiplier Logic:**
```
If Demand Level ≤ 1.0:  Surge = 1.0x
If Demand Level ≤ 1.5:  Surge = 1.2x
If Demand Level ≤ 2.0:  Surge = 1.5x
If Demand Level ≤ 2.5:  Surge = 1.8x
If Demand Level > 2.5:  Surge = 2.0x
```

**Formula:**
```
Total Fare (before minimum) = (Base Fare + Distance Fare + Time Fare) × Surge Multiplier
```

**Example (Bike, Surge 1.2x):**
- Subtotal = ₹30 + ₹235 + ₹30.6 = ₹295.6
- Total Fare = ₹295.6 × 1.2 = ₹354.72

---

### Step 8: Apply Minimum Fare Check

**Formula:**
```
If Total Fare < Minimum Fare:
    Total Fare = Minimum Fare
```

**Example (Bike):**
- If calculated fare = ₹45 (less than ₹50 minimum)
- Final Total Fare = ₹50

---

## Complete Example Calculation

### Scenario: Bike Ride
- **From:** 28.6139°N, 77.2090°E
- **To:** 28.5355°N, 77.3910°E
- **Vehicle:** Bike
- **Surge:** 1.0x (normal)

**Step-by-Step:**

1. **Distance Calculation:**
   - Distance = 25.5 km

2. **Time Estimation:**
   - Time = ⌈(25.5 / 30) × 60⌉ = 51 minutes

3. **Base Fare:**
   - Base Fare = ₹30

4. **Distance Fare:**
   - Extra Distance = 25.5 - 2 = 23.5 km
   - Distance Fare = 23.5 × ₹10 = ₹235

5. **Time Fare:**
   - Time Fare = 51 × ₹0.6 = ₹30.6

6. **Subtotal:**
   - Subtotal = ₹30 + ₹235 + ₹30.6 = ₹295.6

7. **Surge Multiplier:**
   - Total = ₹295.6 × 1.0 = ₹295.6

8. **Minimum Fare Check:**
   - ₹295.6 > ₹50 (minimum) ✓
   - Final Total = ₹295.6

**Final Breakdown:**
- Base Fare: ₹30.00
- Distance Fare: ₹235.00
- Time Fare: ₹30.60
- Surge Multiplier: 1.0x
- **Total Fare: ₹295.60**

---

## Another Example: Car Plus with Surge

### Scenario: Car Plus Ride
- **Distance:** 15 km
- **Vehicle:** Car Plus
- **Surge:** 1.5x (high demand)

**Calculation:**

1. **Distance:** 15 km
2. **Time:** ⌈(15 / 30) × 60⌉ = 30 minutes
3. **Base Fare:** ₹60
4. **Distance Fare:** (15 - 3) × ₹18 = ₹216
5. **Time Fare:** 30 × ₹1.2 = ₹36
6. **Subtotal:** ₹60 + ₹216 + ₹36 = ₹312
7. **With Surge:** ₹312 × 1.5 = ₹468
8. **Minimum Check:** ₹468 > ₹100 ✓
9. **Final Total:** ₹468.00

---

## Key Features

### 1. **Minimum Distance Free**
- First 2-3 km (depending on vehicle) is included in base fare
- Only extra distance is charged

### 2. **Time-Based Pricing**
- Accounts for traffic and waiting time
- Ensures drivers are compensated for time spent

### 3. **Surge Pricing**
- Dynamic pricing based on demand
- Encourages more drivers during peak hours
- Protects against price gouging (max 2.0x)

### 4. **Minimum Fare Guarantee**
- Ensures drivers get minimum compensation
- Protects against very short rides

---

## Pricing Philosophy

This pricing model ensures:
- ✅ Fair compensation for drivers
- ✅ Transparent pricing for users
- ✅ Dynamic adjustment for demand
- ✅ Protection for both parties (minimum fare)
- ✅ Competitive with market leaders (Rapido, Ola, Uber)

---

## Formula Summary

```
Distance (km) = Haversine Formula
Time (min) = ⌈(Distance / 30) × 60⌉
Base Fare = Vehicle-specific fixed amount
Distance Fare = max(0, (Distance - MinDistance)) × PerKmRate
Time Fare = Time × PerMinuteRate
Subtotal = Base Fare + Distance Fare + Time Fare
Total = Subtotal × Surge Multiplier
Final Total = max(Total, Minimum Fare)
```
