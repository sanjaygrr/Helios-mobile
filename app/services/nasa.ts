import axios from 'axios';

// Get one here: https://firms.modaps.eosdis.nasa.gov/api/map_key/
const NASA_API_KEY = '39c6517f6024ee4b82107bb5b61c078f';

const BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';

export interface FirePoint {
    latitude: number;
    longitude: number;
    brightness: number;
    acq_date: string;
    acq_time: string;
}

// Helper to fetch a specific bounding box
const fetchRegion = async (name: string, west: number, south: number, east: number, north: number, dayRange: number): Promise<FirePoint[]> => {
    const source = 'MODIS_NRT';
    const url = `${BASE_URL}/${NASA_API_KEY}/${source}/${west},${south},${east},${north}/${dayRange}`;

    try {
        console.log(`Fetching NASA Data (${name}) from:`, url);
        const response = await axios.get(url);

        if (typeof response.data === 'string' && (response.data.includes('Invalid') || response.data.includes('HTML'))) {
            console.warn(`NASA API Error for ${name}:`, response.data.substring(0, 100));
            return [];
        }

        const rows = response.data.split('\n');
        const regionFires: FirePoint[] = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;

            const cols = row.split(',');
            if (cols.length > 2) {
                const fLat = parseFloat(cols[0]);
                const fLon = parseFloat(cols[1]);

                if (!isNaN(fLat) && !isNaN(fLon)) {
                    regionFires.push({
                        latitude: fLat,
                        longitude: fLon,
                        brightness: parseFloat(cols[2]),
                        acq_date: cols[5],
                        acq_time: cols[6]
                    });
                }
            }
        }
        console.log(`Found ${regionFires.length} fires in ${name}.`);
        return regionFires;
    } catch (error) {
        console.error(`Error fetching NASA fire data for ${name}:`, error);
        return [];
    }
};

// Fetch all fires in Chile by splitting into zones to respect API limits (~100 sq deg)
export const fetchFireData = async (lat?: number, lon?: number): Promise<FirePoint[]> => {
    // Chile is approx Longitude -76 to -66 (Width 10 deg)
    // Latitude -17 to -56 (Height 39 deg)
    // We split into 4 zones of roughly 10 deg height to stay safe within limits.

    const dayRange = 5;
    const west = -76.0;
    const east = -66.0;

    // Define Zones
    const zones = [
        { name: 'North', south: -27.0, north: -17.0 },
        { name: 'North-Center', south: -37.0, north: -27.0 },
        { name: 'South-Center', south: -47.0, north: -37.0 },
        { name: 'South', south: -57.0, north: -47.0 },
    ];

    try {
        const promises = zones.map(zone =>
            fetchRegion(zone.name, west, zone.south, east, zone.north, dayRange)
        );

        const results = await Promise.all(promises);

        // Flatten array
        const allFires = results.flat();

        console.log(`Total active fires found in Chile: ${allFires.length}`);
        return allFires;

    } catch (error) {
        console.error('Error fetching national fire data:', error);
        return [];
    }
};
