import axios from 'axios';

const OPENWEATHER_API_KEY = '66537d5086cbc325c53afdcac46bdf3b';

const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

export interface WeatherData {
    wind: {
        speed: number; // Meter/sec
        deg: number;   // Degrees
        gust?: number;
    };
    main: {
        temp: number;
        humidity: number;
    };
    weather: {
        main: string;
        description: string;
        icon: string;
    }[];
}

export const fetchWeatherData = async (lat: number, lon: number): Promise<WeatherData | null> => {


    try {
        const response = await axios.get(BASE_URL, {
            params: {
                lat,
                lon,
                appid: OPENWEATHER_API_KEY,
                units: 'metric'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        return mockWeatherData();
    }
};

const mockWeatherData = (): WeatherData => {
    return {
        wind: {
            speed: 15.5, // Strong wind
            deg: 240,    // SW
        },
        main: {
            temp: 25,
            humidity: 40,
        },
        weather: [
            { main: "Clear", description: "clear sky", icon: "01d" }
        ]
    };
};
